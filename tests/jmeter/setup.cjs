const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { spawnSync } = require('node:child_process');
const { version, directoryName, toolsDirectory } = require('./jmeter-installation.cjs');

const downloadUrl = `https://archive.apache.org/dist/jmeter/binaries/${directoryName}.zip`;
// SHA-512 publicado em https://archive.apache.org/dist/jmeter/binaries/apache-jmeter-5.6.3.zip.sha512.
const expectedChecksum = '387fadca903ee0aa30e3f2115fdfedb3898b102e6b9fe7cc3942703094bd2e65b235df2b0c6d0d3248e74c9a7950a36e42625fd74425368342c12e40b0163076';
const maximumBytes = 150 * 1024 * 1024;

async function verifyChecksum(filename, expected = expectedChecksum) {
  const hash = createHash('sha512');
  for await (const chunk of fs.createReadStream(filename)) hash.update(chunk);
  if (hash.digest('hex') !== expected) throw new Error('SHA-512 inválido: o ZIP não corresponde ao JMeter esperado. A extração foi bloqueada.');
}

async function download(filename) {
  console.log('Baixando a distribuição oficial: ' + downloadUrl);
  const response = await fetch(downloadUrl, { redirect: 'error', signal: AbortSignal.timeout(300000) });
  if (!response.ok || !response.body) throw new Error('Não foi possível baixar o JMeter: HTTP ' + response.status + '.');
  let bytes = 0;
  const limit = new Transform({
    transform(chunk, encoding, callback) {
      bytes += chunk.length;
      callback(bytes > maximumBytes ? new Error('O download excedeu o tamanho máximo permitido.') : null, chunk);
    }
  });
  await pipeline(Readable.fromWeb(response.body), limit, fs.createWriteStream(filename, { flags: 'wx' }));
}

function runJar(args, cwd) {
  const result = spawnSync('jar', args, { cwd, windowsHide: true, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error('Não foi possível usar o comando jar. Instale o JDK 17 completo, adicione bin ao PATH e reabra o terminal.');
  return result.stdout;
}

async function main() {
  if (process.argv.length > 2) throw new Error('Use npm run setup:jmeter sem argumentos.');
  const target = path.join(toolsDirectory, directoryName);
  const marker = path.join(target, '.khki-verified-sha512');
  if (fs.existsSync(target)) {
    if (fs.existsSync(path.join(target, 'bin', 'ApacheJMeter.jar')) && fs.existsSync(path.join(target, 'lib', 'ext', 'ApacheJMeter_core.jar')) && fs.existsSync(marker) && fs.readFileSync(marker, 'utf8') === expectedChecksum) {
      console.log(`Apache JMeter ${version} já preparado em ${target}.`);
      return;
    }
    throw new Error('Já existe uma instalação local sem confirmação de integridade. Ela não será sobrescrita: ' + target);
  }
  runJar(['--version'], __dirname);
  fs.mkdirSync(toolsDirectory, { recursive: true });
  const archive = path.join(toolsDirectory, directoryName + '.zip');
  const partial = archive + '.' + randomUUID() + '.part';
  const staging = path.join(toolsDirectory, '.extract-' + randomUUID());
  try {
    if (!fs.existsSync(archive)) {
      await download(partial);
      await verifyChecksum(partial);
      fs.renameSync(partial, archive);
    } else {
      console.log('Conferindo SHA-512 do ZIP já disponível.');
      await verifyChecksum(archive);
    }
    console.log('SHA-512 confirmado. Extraindo o JMeter...');
    const entries = runJar(['tf', archive], toolsDirectory).trim().split(/\r?\n/);
    if (entries.some((entry) => !entry.startsWith(directoryName + '/') || entry.includes('\\') || entry.split('/').includes('..'))) throw new Error('O ZIP contém caminhos inesperados. A extração foi bloqueada.');
    fs.mkdirSync(staging);
    runJar(['xf', archive], staging);
    const extracted = path.join(staging, directoryName);
    if (!fs.existsSync(path.join(extracted, 'bin', 'ApacheJMeter.jar')) || !fs.existsSync(path.join(extracted, 'lib', 'ext', 'ApacheJMeter_core.jar'))) throw new Error('O ZIP não contém a distribuição binária completa do JMeter.');
    fs.writeFileSync(path.join(extracted, '.khki-verified-sha512'), expectedChecksum);
    fs.renameSync(extracted, target);
    console.log(`Apache JMeter ${version} pronto em ${target}.`);
    console.log('Agora execute npm run test:jmeter:production:preflight ou npm run test:jmeter.');
    if (process.env.JMETER_HOME) console.log('JMETER_HOME está definido e continua tendo prioridade sobre esta instalação local.');
  } finally {
    if (fs.existsSync(partial)) fs.unlinkSync(partial);
    const resolved = path.resolve(staging);
    if (path.dirname(resolved) !== path.resolve(toolsDirectory) || !path.basename(resolved).startsWith('.extract-')) throw new Error('Diretório temporário fora do local esperado.');
    if (fs.existsSync(resolved)) fs.rmSync(resolved, { recursive: true, force: true });
  }
}

if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });

module.exports = { main, verifyChecksum };