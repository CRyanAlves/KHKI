const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');
const prettier = path.join(root, 'frontend/node_modules/prettier/bin/prettier.cjs');
const java = path.join(root, 'frontend/node_modules/prettier-plugin-java/dist/index.mjs');
if (!fs.existsSync(prettier) || !fs.existsSync(java)) {
  console.error('Instale as dependências: npm.cmd ci --prefix frontend');
  process.exit(1);
}
if (process.argv.slice(2).some((argument) => argument !== '--check')) {
  console.error('Use npm.cmd run format ou npm.cmd run format:check.');
  process.exit(1);
}
const mode = process.argv.includes('--check') ? '--check' : '--write';
const result = spawnSync(process.execPath, [prettier, '**/*', mode, '--ignore-unknown', '--ignore-path', '.gitignore', '--ignore-path', '.prettierignore', '--config', 'frontend/.prettierrc', '--plugin', java], { cwd: root, stdio: 'inherit', windowsHide: true });
if (result.error) console.error('Não foi possível executar o Prettier. Confira a instalação das dependências.');
process.exitCode = result.status ?? 1;
