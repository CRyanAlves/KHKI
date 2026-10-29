import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/config.js', route => route.fulfill({ contentType: 'application/javascript', body: "window.KHKI_CONFIG = { geoapifyApiKey: 'browser-test' };" }));
  await page.route(url => url.pathname.endsWith('/style.json'), route => route.fulfill({ json: { version: 8, sources: {}, layers: [] } }));
});

test('granted geolocation restores a current map position after reload without saving coordinates', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']); await context.setGeolocation({ latitude: -23.09, longitude: -47.21 });
  await page.goto('/'); await expect(page.locator('.map-position')).toBeVisible();
  const point = () => page.locator('app-map').evaluate(element => (window as unknown as { ng: { getComponent(element: Element): { point: { lat: number; lng: number } } } }).ng.getComponent(element).point);
  await expect.poll(point).toEqual({ lat: -23.09, lng: -47.21 });
  await context.setGeolocation({ latitude: -23.1, longitude: -47.22 }); await page.reload();
  await expect(page.locator('.map-position')).toBeVisible(); await expect.poll(point).toEqual({ lat: -23.1, lng: -47.22 });
  await page.locator('.bathroom-card').first().click(); await page.getByRole('link', { name: 'Voltar aos resultados', exact: true }).click(); await expect(page.locator('.map-position')).toBeVisible();
  expect(await page.evaluate(() => Object.entries(localStorage).concat(Object.entries(sessionStorage)).some(([key, value]) => /location|latitude|longitude|position/i.test(key) || /-23\.1|-47\.22/.test(value)))).toBe(false);
});

for (const permission of ['prompt', 'denied', 'unsupported', 'failure'] as const) {
  test('automatic geolocation handles ' + permission + ' without blocking explicit location', async ({ page }) => {
    await page.addInitScript(permission => {
      const state = window as unknown as { locationChecks: number; locationRequests: number }; state.locationChecks = 0; state.locationRequests = 0;
      Object.defineProperty(navigator.permissions, 'query', { value: async () => { state.locationChecks++; if (permission === 'unsupported') throw new Error('Unsupported'); return { state: permission === 'failure' ? 'granted' : permission }; } });
      Object.defineProperty(navigator.geolocation, 'getCurrentPosition', { value: (success: PositionCallback, failure: PositionErrorCallback) => { state.locationRequests++; if (permission === 'failure' && state.locationRequests === 1) { failure({ code: 3 } as GeolocationPositionError); return; } success({ coords: { latitude: -23.09, longitude: -47.21 } } as GeolocationPosition); } });
    }, permission);
    await page.goto('/');
    await expect.poll(() => page.evaluate(() => (window as unknown as { locationChecks: number }).locationChecks)).toBe(1);
    expect(await page.evaluate(() => (window as unknown as { locationRequests: number }).locationRequests)).toBe(permission === 'failure' ? 1 : 0);
    await expect(page.locator('.map-position')).toHaveCount(0);
    await page.getByRole('button', { name: 'Usar minha localização', exact: true }).click(); await expect(page.locator('.map-position')).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Localização obtida' })).toBeVisible();
  });
}