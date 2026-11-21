const fs = require('node:fs');
const path = require('node:path');
const { readEnvironment } = require('./environment.cjs');

function generateConfig({ root = path.resolve(__dirname, '..'), environment = process.env } = {}) {
  const configuration = readEnvironment(root, environment);
  const geoapifyApiKey = (configuration.GEOAPIFY_API_KEY || '').trim();
  if (geoapifyApiKey && !/^[A-Za-z0-9_-]{1,256}$/.test(geoapifyApiKey)) throw new Error('GEOAPIFY_API_KEY deve conter somente letras, números, hífen ou sublinhado, com até 256 caracteres.');
  const simulationFlag = (configuration.DEV_ROUTE_SIMULATION || 'false').trim().toLowerCase();
  if (!['true', 'false'].includes(simulationFlag)) throw new Error('DEV_ROUTE_SIMULATION deve ser true ou false.');
  const devRouteSimulation = simulationFlag === 'true';
  const target = path.join(root, 'frontend/public/config.js');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, 'window.KHKI_CONFIG = ' + JSON.stringify({ geoapifyApiKey, devRouteSimulation }) + ';', 'utf8');
}

if (require.main === module) {
  try {
    generateConfig();
    console.log('Configuração pública do frontend gerada a partir do ambiente.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { generateConfig };
