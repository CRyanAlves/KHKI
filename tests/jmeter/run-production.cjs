const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { getJmeterHome } = require('./jmeter-installation.cjs');
const { csvRows, metrics } = require('./run-local.cjs');

function parseOptions(options) {
  const preflightOnly = options.includes('--preflight');
  const requestOptions = options.filter((option) => option.startsWith('--requests='));
  if (options.some((option) => option !== '--preflight' && !option.startsWith('--requests=')) || requestOptions.length > 1 || options.filter((option) => option === '--preflight').length > 1) throw new Error('Opção inválida. Use --preflight ou --requests=100.');
  if (preflightOnly && requestOptions.length) throw new Error('Use --requests somente no teste completo, sem --preflight.');
  const value = requestOptions[0]?.slice('--requests='.length);
  if (value !== undefined && (!/^[1-9][0-9]*$/.test(value) || Number(value) > 100)) throw new Error('--requests deve ser um inteiro entre 1 e 100.');
  return {
    preflightOnly,
    requestLimit: value === undefined ? null : Number(value)
  };
}

async function main() {
  const { preflightOnly, requestLimit } = parseOptions(process.argv.slice(2));
  const jmeterHome = getJmeterHome();
  const jar = path.join(jmeterHome, 'bin', 'ApacheJMeter.jar');
  if (!fs.existsSync(jar)) throw new Error('Execute npm run setup:jmeter ou configure JMETER_HOME com o Apache JMeter 5.6.3.');
  const suffix = preflightOnly ? '-preflight' : requestLimit ? `-${requestLimit}-requests` : '-1-vu';
  const output = path.join(__dirname, 'results', 'production', new Date().toISOString().replace(/[:.]/g, '-') + suffix);
  fs.mkdirSync(output, { recursive: true });
  const summary = {
    target: 'https://khki.cradev.workers.dev',
    users: 1,
    mode: preflightOnly ? 'preflight' : requestLimit ? 'requests' : 'duration',
    requestLimit,
    durationSeconds: preflightOnly ? 0 : requestLimit ? null : 60,
    phases: []
  };
  const phases = [{ name: 'preflight', plan: 'khki-production-preflight.jmx' }];
  if (!preflightOnly) phases.push({ name: 'load-1-vu', plan: 'khki-production-readonly.jmx' });
  const workload = requestLimit ? `até ${requestLimit} consultas sequenciais, além do pré-teste` : 'um usuário por 60 segundos';
  console.log('Destino de produção: ' + summary.target + '. Somente consultas GET, sem operações de escrita.');
  if (!preflightOnly) console.log('Carga: ' + workload + '.');
  console.log('Relatórios: ' + output);
  try {
    for (const phase of phases) {
      const directory = path.join(output, phase.name);
      fs.mkdirSync(directory);
      const args = ['-Xms128m', '-Xmx512m', '-Djava.awt.headless=true', '-jar', jar, '-d', jmeterHome, '-n', '-t', path.join(__dirname, phase.plan), '-Jusers=1', '-Jramp=1', '-l', path.join(directory, 'results.jtl'), '-j', path.join(directory, 'jmeter.log'), '-e', '-o', path.join(directory, 'dashboard')];
      if (phase.name === 'load-1-vu' && requestLimit) args.push(`-Jrequests=${requestLimit}`, '-Jscheduled=false');
      console.log('Executando: ' + phase.name);
      await new Promise((resolve, reject) => {
        const child = spawn('java', args, {
          cwd: path.resolve(__dirname, '../..'),
          windowsHide: true,
          stdio: 'inherit'
        });
        child.once('error', () => reject(new Error('Não foi possível iniciar o Java. Confira a instalação e o PATH.')));
        child.once('exit', (code) => (code === 0 ? resolve() : reject(new Error('JMeter encerrou com falha. Consulte os logs em ' + directory))));
      });
      const rows = csvRows(path.join(directory, 'results.jtl'));
      if (!rows.length) throw new Error('JMeter não gerou amostras; a execução foi interrompida.');
      const measured = metrics(rows);
      const groups = Object.groupBy(rows, (row) => row.label);
      const result = {
        name: phase.name,
        ...measured,
        endpoints: Object.fromEntries(Object.entries(groups).map(([label, samples]) => [label, metrics(samples)])),
        dashboard: phase.name + '/dashboard/index.html',
        initialGate: {
          passed: measured.failures === 0 && measured.p95Ms <= 1000,
          p95ReferenceMs: 1000
        }
      };
      summary.phases.push(result);
      console.log(`${phase.name}: ${measured.samples} amostras, ${measured.failures} falhas, p95 ${measured.p95Ms} ms.`);
      if (measured.failures > 0) throw new Error('Falha HTTP ou de contrato. O teste foi interrompido, sem ampliar a carga.');
      if (phase.name === 'load-1-vu' && requestLimit && measured.samples !== requestLimit) throw new Error(`Execução incompleta: esperadas ${requestLimit} consultas, recebidas ${measured.samples}.`);
      if (measured.p95Ms > 1000) console.log('O p95 excedeu a referência de 1000 ms. Avalie o relatório antes de considerar cargas maiores.');
    }
    console.log('Execução concluída. Relatórios: ' + output);
  } catch (error) {
    summary.error = error.message;
    throw error;
  } finally {
    fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2));
    const description = preflightOnly ? 'Somente uma verificação de saúde.' : 'Carga: ' + workload + '. A carga só começa após o pré-teste passar.';
    const lines = [
      '# KHKI — teste de produção JMeter',
      '',
      'Destino: ' + summary.target + '. Consultas públicas GET, somente leitura. ' + description,
      '',
      '| Etapa | Amostras | Falhas | Média (ms) | p95 (ms) |',
      '| --- | --- | --- | --- | --- |',
      ...summary.phases.map((phase) => `| ${phase.name} | ${phase.samples} | ${phase.failures} | ${phase.averageMs} | ${phase.p95Ms} |`),
      '',
      ...summary.phases.map((phase) => `[Dashboard ${phase.name}](${phase.dashboard})`),
      '',
      summary.error || 'Execução concluída. A referência de p95 até 1000 ms é informativa; ausência de falhas não comprova capacidade máxima nem aprovação de desempenho.'
    ];
    fs.writeFileSync(path.join(output, 'summary.md'), lines.join('\n'));
    const links = summary.phases.map((phase) => `<li><a href="${phase.dashboard}">Dashboard ${phase.name}</a></li>`).join('\n');
    fs.writeFileSync(path.join(output, 'index.html'), '<!doctype html>\n<html lang="pt-BR"><meta charset="utf-8"><title>KHKI — JMeter produção</title><h1>Teste de produção</h1><p><a href="summary.md">Resumo</a></p><ul>' + links + '</ul></html>');
  }
}

if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });

module.exports = { main, parseOptions };