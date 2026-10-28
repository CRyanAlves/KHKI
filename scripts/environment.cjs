const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');

function readEnvironment(root, environment = process.env) {
  const file = path.join(root, '.env');
  const local = fs.existsSync(file) ? parseEnv(fs.readFileSync(file, 'utf8')) : {};
  return { ...local, ...environment };
}

module.exports = { readEnvironment };
