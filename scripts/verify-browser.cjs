const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const root = path.resolve(__dirname, '..');
fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
const environment = {
  ...process.env,
  PORT: '8082',
  DATABASE_URL: 'jdbc:h2:mem:browser;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1',
  DATABASE_USER: 'sa',
  DATABASE_PASSWORD: '',
  DEMO_DATA: 'true',
  ADMIN_EMAIL: 'browser-admin@khki.test',
  ADMIN_PASSWORD: randomBytes(24).toString('hex'),
  FRONTEND_ORIGIN: 'http://127.0.0.1:4202',
  COOKIE_SECURE: 'false',
  KHKI_BASE_URL: 'http://127.0.0.1:4202'
};
environment.KHKI_TEST_ADMIN_EMAIL = environment.ADMIN_EMAIL;
environment.KHKI_TEST_ADMIN_PASSWORD = environment.ADMIN_PASSWORD;
environment.KHKI_MAPS_SIMULATION_URL = 'http://127.0.0.1:4900/geoapify';
const children = [];
function launch(command, directory, logName) {
  const child = spawn('cmd.exe', ['/d', '/s', '/c', command], { cwd: path.join(root, directory), env: environment, windowsHide: true });
  const log = fs.createWriteStream(path.join(root, 'test-results', logName));
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  children.push(child);
  return child;
}
async function free(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', () => reject(new Error(`A porta ${port} está ocupada. Libere-a antes de executar os testes isolados.`)));
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}
async function wait(url, child) {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (child.exitCode !== null) throw new Error('Um serviço de teste encerrou antes de iniciar. Consulte test-results/browser-*.log.');
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('Tempo limite ao iniciar os serviços de teste. Consulte test-results/browser-*.log.');
}
async function stop(child) {
  if (child.exitCode !== null) return;
  await new Promise((resolve) => {
    const task = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    task.once('exit', resolve);
  });
}
(async () => {
  try {
    await free(8082);
    await free(4202);
    await free(4900);
    const maps = launch('node scripts/fixtures/geoapify.cjs', '.', 'browser-maps.log');
    const api = launch('mvn.cmd spring-boot:run -q', 'backend', 'browser-api.log');
    const frontend = launch('node node_modules/@angular/cli/bin/ng.js serve --host 127.0.0.1 --port 4202 --proxy-config proxy.e2e.json', 'frontend', 'browser-frontend.log');
    console.log('Iniciando API e frontend isolados nas portas 8082 e 4202, com banco em memória.');
    await wait('http://127.0.0.1:8082/api/health', api);
    await wait('http://127.0.0.1:4202', frontend);
    await wait('http://127.0.0.1:4900/geoapify/health', maps);
    const result = await new Promise((resolve) => {
      const tests = spawn(process.execPath, [path.join(root, 'frontend/node_modules/@playwright/test/cli.js'), 'test', ...process.argv.slice(2)], { cwd: path.join(root, 'frontend'), env: environment, stdio: 'inherit', windowsHide: true });
      tests.once('exit', (code) => resolve(code));
    });
    process.exitCode = result || 0;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await Promise.all(children.map(stop));
  }
})();
