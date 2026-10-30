import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import worker, { isKeepAliveWindow, keepApiAwake, proxyApi } from './worker.mjs';

test('an absent or unsafe API origin returns a non-cacheable error without forwarding', async () => {
  for (const API_ORIGIN of [undefined, '', 'http://example.com', 'https://user:password@example.com', 'https://example.com/path', 'https://example.com?target=other']) {
    const response = await proxyApi(new Request('https://khki.example/api/auth/me'), { API_ORIGIN });
    assert.equal(response.status, 503); assert.equal(response.headers.get('Cache-Control'), 'no-store'); assert.equal((await response.json()).status, 503);
  }
});

test('API paths never fall back to the Angular HTML document', async () => {
  const ASSETS = { fetch: () => { throw new Error('An API request reached static assets.'); } };
  for (const path of ['/api', '/api/health', '/api/auth/csrf']) assert.equal((await worker.fetch(new Request('https://khki.example' + path), { ASSETS })).status, 503);
});

test('client routes retain the static SPA handler', async () => {
  let requested = '';
  const response = await worker.fetch(new Request('https://khki.example/banheiros/selected/rota'), { ASSETS: { fetch: request => { requested = new URL(request.url).pathname; return new Response('Angular'); } } });
  assert.equal(requested, '/banheiros/selected/rota'); assert.equal(await response.text(), 'Angular');
});

test('keep-alive follows Brasilia boundaries including the UTC date rollover', () => {
  for (const [time, expected] of [['2026-10-30T09:59:59Z', false], ['2026-10-30T10:00:00Z', true], ['2026-10-31T00:00:00Z', true], ['2026-10-31T01:50:00Z', true], ['2026-10-31T01:59:59Z', true], ['2026-10-31T02:00:00Z', false], ['2026-10-31T03:00:00Z', false]]) assert.equal(isKeepAliveWindow(Date.parse(time)), expected, time);
  assert.equal(isKeepAliveWindow(NaN), false);
  const config = JSON.parse(readFileSync(new URL('./wrangler.jsonc', import.meta.url), 'utf8'));
  assert.deepEqual(config.triggers.crons, ['*/10 0-1,10-23 * * *']);
});

test('keep-alive makes no requests outside the active window', async () => {
  const result = await keepApiAwake({}, Date.parse('2026-10-31T02:00:00Z'), () => { throw new Error('Unexpected request'); });
  assert.deepEqual(result, { skipped: true });
});

test('keep-alive only calls the configured health endpoint without credentials or redirects', async () => {
  let calls = 0;
  const result = await keepApiAwake({ API_ORIGIN: 'https://khki-api.example' }, Date.parse('2026-10-30T10:00:00Z'), async request => {
    calls++; assert.equal(request.url, 'https://khki-api.example/api/health'); assert.equal(request.method, 'GET'); assert.equal(request.redirect, 'manual'); assert.equal(request.headers.get('Cookie'), null); assert.equal(request.headers.get('Authorization'), null); assert.equal(request.headers.get('Cache-Control'), 'no-cache'); assert.ok(request.signal); return new Response('{"status":"UP"}');
  });
  assert.equal(calls, 1); assert.deepEqual(result, { skipped: false, status: 200 });
});

test('keep-alive rejects unsafe configuration, HTTP failures and network errors without leaking details', async () => {
  const time = Date.parse('2026-10-30T10:00:00Z');
  for (const API_ORIGIN of [undefined, 'http://example.com', 'https://user:secret@example.com', 'https://example.com/path']) await assert.rejects(keepApiAwake({ API_ORIGIN }, time, () => { throw new Error('Unexpected request'); }), /Configuração da API/);
  for (const status of [302, 503]) await assert.rejects(keepApiAwake({ API_ORIGIN: 'https://khki-api.example' }, time, async () => new Response(null, { status })), new RegExp('HTTP ' + status));
  await assert.rejects(keepApiAwake({ API_ORIGIN: 'https://khki-api.example' }, time, async () => { throw new Error('Private network details'); }), { message: 'Não foi possível consultar a saúde da API no agendamento.' });
});
