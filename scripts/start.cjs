const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { readEnvironment } = require('./environment.cjs');
const { generateConfig } = require('./generate-config.cjs');
const root = path.resolve(__dirname, '..');
Object.assign(process.env, readEnvironment(root));
if (!fs.existsSync(path.join(root, 'frontend/node_modules'))) {
  console.error('Instale as dependências primeiro: cd frontend e npm.cmd ci');
  process.exit(1);
}
generateConfig({ root });
const children = [];
let stopping = false;
function start(command, directory) {
  const child = spawn('cmd.exe', ['/d', '/s', '/c', command], { cwd: path.join(root, directory), stdio: 'inherit', windowsHide: true });
  children.push(child);
  child.on('exit', () => {
    if (!stopping) void stop();
  });
  return child;
}
async function stop() {
  if (stopping) return;
  stopping = true;
  await Promise.all(
    children
      .filter((child) => child.exitCode === null)
      .map(
        (child) =>
          new Promise((resolve) => {
            const task = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
            task.once('exit', resolve);
          })
      )
  );
  process.exitCode = 0;
}
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
console.log('KHKI: API na porta 8080 e frontend na porta 4200. Ctrl+C encerra os dois serviços.');
start('mvn.cmd spring-boot:run', 'backend');
start('npm.cmd start', 'frontend');
(async () => {
  for (let attempt = 0; attempt < 120 && !stopping; attempt++) {
    try {
      if ((await fetch('http://127.0.0.1:4200')).ok) {
        spawn('cmd.exe', ['/d', '/s', '/c', 'start "" "http://127.0.0.1:4200"'], { windowsHide: true, stdio: 'ignore' });
        return;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
})();
