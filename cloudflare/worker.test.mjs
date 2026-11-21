import assert from 'node:assert/strict';
import test from 'node:test';
import worker, { proxyApi } from './worker.mjs';

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