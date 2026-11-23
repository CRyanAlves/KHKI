const { spawn, execFileSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { getJmeterHome } = require('./jmeter-installation.cjs');

const root = path.resolve(__dirname, '../..');
const jmeterHome = getJmeterHome();
const jmeterJar = path.join(jmeterHome, 'bin', 'ApacheJMeter.jar');
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const output = path.join(__dirname, 'results', 'local', runId);
const port = 8083;
const origin = 'http://127.0.0.1:4203';
const username = 'jmeter@khki.test';
const password = randomBytes(24).toString('hex');
const credentialsFile = path.join(output, 'temporary-local.properties');
const phases = [
  { name: 'warmup-1-vu', users: 1, duration: 10, ramp: 1 },
  { name: 'load-5-vu', users: 5, duration: 30, ramp: 5 },
  { name: 'load-10-vu', users: 10, duration: 45, ramp: 10 }
];
let api;

function launch(command, args, cwd, logName, environment = process.env) {
  const child = spawn(command, args, {
    cwd,
    env: environment,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const log = fs.createWriteStream(path.join(output, logName));
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  const finished = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => (code === 0 ? resolve() : reject(new Error(`${logName}: processo terminou com ${code ?? signal}. Consulte o log.`))));
  });
  finished.catch(() => {});
  return { child, finished };
}

async function assertFreePort() {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', () => reject(new Error(`A porta local ${port} está ocupada. Nenhum processo existente será encerrado.`)));
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}

async function ready() {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (api.child.exitCode !== null) throw new Error('A API local encerrou durante a inicialização.');
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
        signal: AbortSignal.timeout(2000)
      });
      if (response.ok && (await response.json()).status === 'UP') return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('A API local não ficou pronta dentro de 120 segundos.');
}

function csvRows(filename) {
  const lines = fs.readFileSync(filename, 'utf8').trim().split(/\r?\n/);
  const split = (line) => [...line.matchAll(/(?:^|,)(?:"((?:[^"]|"")*)"|([^,]*))/g)].map((match) => (match[1] ?? match[2]).replaceAll('""', '"'));
  const headers = split(lines.shift());
  return lines.map((line) => Object.fromEntries(split(line).map((value, index) => [headers[index], value])));
}

function metrics(rows) {
  const times = rows.map((row) => Number(row.elapsed)).sort((first, second) => first - second);
  const percentile = (fraction) => {
    if (!times.length) return 0;
    const position = fraction * (times.length + 1);
    if (position < 1) return times[0];
    if (position >= times.length) return times.at(-1);
    const lower = Math.floor(position);
    return Number((times[lower - 1] + (position - lower) * (times[lower] - times[lower - 1])).toFixed(2));
  };
  const start = Math.min(...rows.map((row) => Number(row.timeStamp)));
  const end = Math.max(...rows.map((row) => Number(row.timeStamp) + Number(row.elapsed)));
  const failures = rows.filter((row) => row.success !== 'true').length;
  return {
    samples: rows.length,
    failures,
    errorPercent: Number(((failures / Math.max(1, rows.length)) * 100).toFixed(2)),
    averageMs: Number((times.reduce((sum, time) => sum + time, 0) / Math.max(1, times.length)).toFixed(2)),
    p50Ms: percentile(0.5),
    p95Ms: percentile(0.95),
    p99Ms: percentile(0.99),
    maximumMs: times.at(-1) || 0,
    requestsPerSecond: Number((rows.length / Math.max(1, (end - start) / 1000)).toFixed(2))
  };
}

async function main() {
  if (!fs.existsSync(jmeterJar)) throw new Error('Execute npm run setup:jmeter ou configure JMETER_HOME com o Apache JMeter 5.6.3.');
  await assertFreePort();
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(credentialsFile, `username=${username}\npassword=${password}\n`);
  console.log('Compilando a API; os logs não exibem credenciais.');
  const build = process.platform === 'win32' ? launch('cmd.exe', ['/d', '/s', '/c', 'mvn.cmd -q -DskipTests package'], path.join(root, 'backend'), 'build.log') : launch('mvn', ['-q', '-DskipTests', 'package'], path.join(root, 'backend'), 'build.log');
  await build.finished;
  const environment = {
    ...process.env,
    SPRING_PROFILES_ACTIVE: '',
    SPRING_CONFIG_ADDITIONAL_LOCATION: '',
    PORT: String(port),
    DATABASE_URL: 'jdbc:h2:mem:jmeter;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1',
    DATABASE_USER: 'sa',
    DATABASE_PASSWORD: '',
    DEMO_DATA: 'true',
    ADMIN_EMAIL: username,
    ADMIN_PASSWORD: password,
    FRONTEND_ORIGIN: origin,
    COOKIE_SECURE: 'false',
    MEDIA_STORAGE_DRIVER: 'local',
    MEDIA_STORAGE_DIRECTORY: path.join(output, 'images'),
    MEDIA_MIGRATE_LEGACY: 'false',
    R2_ENDPOINT: '',
    R2_BUCKET: '',
    R2_ACCESS_KEY_ID: '',
    R2_SECRET_ACCESS_KEY: ''
  };
  api = launch('java', ['-Xms128m', '-Xmx512m', '-jar', path.join(root, 'backend/target/khki-api-0.1.0.jar'), '--server.address=127.0.0.1'], path.join(root, 'backend'), 'api.log', environment);
  await ready();
  console.log('API isolada pronta em 127.0.0.1:8083, com três banheiros de demonstração.');
  const summary = {
    createdAt: new Date().toISOString(),
    commit: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8'
    }).trim(),
    jmeterVersion: '5.6.3',
    target: 'http://127.0.0.1:8083',
    database: 'H2 em memória, modo PostgreSQL; sem Supabase/R2',
    runtime: {
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
      logicalCpus: os.availableParallelism(),
      apiHeapMiB: 512,
      jmeterHeapMiB: 512
    },
    phases: []
  };
  for (const phase of phases) {
    const directory = path.join(output, phase.name);
    fs.mkdirSync(directory);
    console.log(`JMeter: ${phase.name}, ${phase.users} usuários públicos por ${phase.duration}s; depois duas sessões autenticadas sequenciais.`);
    const args = [
      '-Xms128m',
      '-Xmx512m',
      '-Djava.awt.headless=true',
      '-jar',
      jmeterJar,
      '-d',
      jmeterHome,
      '-n',
      '-t',
      path.join(__dirname, 'khki.jmx'),
      '-q',
      credentialsFile,
      `-Jusers=${phase.users}`,
      `-Jduration=${phase.duration}`,
      `-Jramp=${phase.ramp}`,
      '-JauthLoops=2',
      '-JthinkMs=250',
      '-Jhost=127.0.0.1',
      `-Jport=${port}`,
      `-Jorigin=${origin}`,
      '-Jjmeter.save.saveservice.output_format=csv',
      '-Jjmeter.save.saveservice.print_field_names=true',
      '-Jjmeter.save.saveservice.response_data=false',
      '-Jjmeter.save.saveservice.samplerData=false',
      '-Jjmeter.save.saveservice.requestHeaders=false',
      '-Jjmeter.save.saveservice.responseHeaders=false',
      '-Jjmeter.reportgenerator.overall_granularity=1000',
      '-l',
      path.join(directory, 'results.jtl'),
      '-j',
      path.join(directory, 'jmeter.log'),
      '-e',
      '-o',
      path.join(directory, 'dashboard')
    ];
    const run = launch('java', args, root, phase.name + '.log');
    await run.finished;
    const rows = csvRows(path.join(directory, 'results.jtl'));
    if (!rows.length) throw new Error('JMeter não gerou amostras.');
    const groups = Object.groupBy(rows, (row) => row.label);
    const measured = metrics(rows);
    const result = {
      ...phase,
      ...measured,
      endpoints: Object.fromEntries(Object.entries(groups).map(([label, samples]) => [label, metrics(samples)])),
      failuresDetail: rows
        .filter((row) => row.success !== 'true')
        .slice(0, 10)
        .map((row) => ({
          label: row.label,
          status: row.responseCode,
          message: row.failureMessage
        })),
      initialGate: {
        errorPercent: 0,
        p95Ms: 1000,
        passed: measured.failures === 0 && measured.p95Ms <= 1000
      },
      dashboard: path.join(directory, 'dashboard', 'index.html')
    };
    summary.phases.push(result);
    fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2));
    console.log(`${phase.name}: ${measured.samples} amostras, ${measured.failures} falhas, p95 ${measured.p95Ms} ms.`);
    if (measured.failures > 0) throw new Error('Foram detectadas falhas HTTP ou de contrato; a carga não será ampliada. Consulte summary.json.');
  }
  const lines = [
    '# KHKI — resultado do ensaio JMeter',
    '',
    'Ambiente local isolado, com H2 em memória, três banheiros de demonstração e conta administrativa temporária. A API e o gerador de carga usam a mesma máquina. Os resultados não representam capacidade de produção, PostgreSQL/Supabase, R2, Geoapify ou desempenho visual do Angular.',
    '',
    '| Etapa | Usuários públicos | Amostras | Falhas | Média (ms) | p95 (ms) | Req/s |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...summary.phases.map((phase) => `| ${phase.name} | ${phase.users} | ${phase.samples} | ${phase.failures} | ${phase.averageMs} | ${phase.p95Ms} | ${phase.requestsPerSecond} |`),
    '',
    'Cada etapa executa também duas sessões autenticadas sequenciais com um usuário virtual. Os retornos 401 após logout são esperados e verificados. O aquecimento não é uma medição de capacidade. O critério inicial de observação é ausência de falhas e p95 até 1000 ms; não é um SLA contratado.',
    '',
    'Os relatórios HTML ficam em <etapa>/dashboard/index.html; as amostras detalhadas ficam em <etapa>/results.jtl.'
  ];
  fs.writeFileSync(path.join(output, 'summary.md'), lines.join('\n') + '\n');
  console.log('Relatórios concluídos: ' + output);
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      if (api && api.child.exitCode === null) {
        api.child.kill();
        await api.finished.catch(() => {});
      }
      if (fs.existsSync(credentialsFile)) fs.unlinkSync(credentialsFile);
    });
}

module.exports = { csvRows, metrics };