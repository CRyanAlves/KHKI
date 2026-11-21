const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { generateConfig } = require('./generate-config.cjs');

function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'khki-config-'));
  try { run(root); }
  finally {
    for (const file of ['frontend/public/config.js', '.env']) { const target = path.join(root, file); if (fs.existsSync(target)) fs.unlinkSync(target); }
    for (const directory of ['frontend/public', 'frontend', '']) { const target = path.join(root, directory); if (fs.existsSync(target)) fs.rmdirSync(target); }
  }
}
function readConfig(root) { const source = fs.readFileSync(path.join(root, 'frontend/public/config.js'), 'utf8'); return JSON.parse(source.slice('window.KHKI_CONFIG = '.length, -1)); }

test('reads quoted root env and publishes only the browser key', () => fixture(root => {
  fs.writeFileSync(path.join(root, '.env'), 'GEOAPIFY_API_KEY="local-test-key"\nDATABASE_PASSWORD=private-database-value\nADMIN_PASSWORD=private-admin-value');
  generateConfig({ root, environment: {} });
  assert.deepEqual(readConfig(root), { geoapifyApiKey: 'local-test-key' });
  const source = fs.readFileSync(path.join(root, 'frontend/public/config.js'), 'utf8');
  assert.equal(source.includes('private-database-value'), false); assert.equal(source.includes('private-admin-value'), false);
}));
test('deployment environment takes precedence over local env', () => fixture(root => {
  fs.writeFileSync(path.join(root, '.env'), 'GEOAPIFY_API_KEY=local-test-key');
  generateConfig({ root, environment: { GEOAPIFY_API_KEY: 'deployment-test-key' } });
  assert.deepEqual(readConfig(root), { geoapifyApiKey: 'deployment-test-key' });
}));
test('an absent key clears stale public configuration', () => fixture(root => {
  generateConfig({ root, environment: { GEOAPIFY_API_KEY: 'stale-test-key' } });
  generateConfig({ root, environment: {} });
  assert.deepEqual(readConfig(root), { geoapifyApiKey: '' });
}));
test('invalid key is rejected without exposing its value', () => fixture(root => {
  const invalid = 'invalid-key; private-value';
  assert.throws(() => generateConfig({ root, environment: { GEOAPIFY_API_KEY: invalid } }), error => error.message.includes('GEOAPIFY_API_KEY') && !error.message.includes(invalid));
  assert.equal(fs.existsSync(path.join(root, 'frontend/public/config.js')), false);
}));
