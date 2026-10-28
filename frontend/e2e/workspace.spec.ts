import { expect, test } from '@playwright/test';

const simulation = process.env['KHKI_MAPS_SIMULATION_URL'];
test.beforeEach(async ({ page }) => {
  test.skip(!simulation, 'Execute npm test para iniciar os serviços isolados.');
  await page.route('**/config.js', route => route.fulfill({ contentType: 'application/javascript', body: `window.KHKI_CONFIG = ${JSON.stringify({ geoapifyApiKey: 'simulation-key', geoapifyApiBaseUrl: simulation + '/v1', geoapifyMapsBaseUrl: simulation + '/v1' })};` }));
});

test('one map survives selection, route, browser history and panel collapse with search context', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 650 });
  let styles = 0; page.on('request', request => { if (request.url().includes('/styles/positron/style.json')) styles++; });
  await page.goto('/'); await expect(page.locator('.map-marker')).toHaveCount(3);
  const map = await page.locator('app-map').elementHandle(); const header = await page.locator('.site-header').boundingBox();
  const panel = page.locator('.workspace-panel');
  await page.getByRole('button', { name: 'Filtros', exact: true }).click();
  await page.getByRole('combobox', { name: 'Condição de acesso', exact: true }).selectOption('FREE');
  await expect(page.getByText('2 banheiros encontrados', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Ordenação', exact: true }).selectOption('rating');
  await panel.evaluate(element => { element.scrollTop = 100; }); const scroll = await panel.evaluate(element => element.scrollTop); expect(scroll).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Café do Centro', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Café do Centro', exact: true })).toBeVisible();
  await expect(page.locator('.map-marker.is-selected')).toHaveCount(1);
  expect(await map!.evaluate(element => element === document.querySelector('app-map'))).toBe(true);
  expect(await page.locator('.site-header').boundingBox()).toEqual(header);
  await page.getByRole('link', { name: 'Como chegar', exact: true }).click();
  await page.getByRole('textbox', { name: 'Sua origem' }).fill('Rua de teste, São Paulo');
  await page.getByRole('button', { name: 'Calcular rota', exact: true }).click();
  await expect(page.getByText('1,1 km de carro', { exact: true })).toBeVisible();
  expect(await map!.evaluate(element => element === document.querySelector('app-map'))).toBe(true);
  expect(await page.locator('.site-header').boundingBox()).toEqual(header);
  await page.goBack(); await expect(page.getByRole('heading', { name: 'Café do Centro', exact: true })).toBeVisible();
  await page.goForward(); await expect(page.getByRole('textbox', { name: 'Sua origem' })).toHaveValue('Rua de teste, São Paulo');
  await expect(page.getByText('1,1 km de carro', { exact: true })).toBeVisible();
  await page.goBack(); await page.getByRole('link', { name: 'Voltar aos resultados', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Condição de acesso', exact: true })).toHaveValue('FREE');
  await expect(page.getByRole('combobox', { name: 'Ordenação', exact: true })).toHaveValue('rating');
  await expect.poll(() => panel.evaluate(element => element.scrollTop)).toBeCloseTo(scroll, 0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(styles).toBe(1);
  await page.getByRole('button', { name: 'Recolher painel', exact: true }).click();
  await expect(panel).toBeHidden(); await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Reabrir painel', exact: true }).click(); await expect(panel).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Condição de acesso', exact: true })).toHaveValue('FREE');
  expect(await map!.evaluate(element => element === document.querySelector('app-map'))).toBe(true);
});

test('direct links, map area, marker highlight and mobile sheet remain usable', async ({ page, context }) => {
  const bathrooms = await (await page.request.get('/api/bathrooms')).json(); const bathroom = bathrooms.find((value: { name: string }) => value.name === 'Café do Centro');
  await page.goto('/banheiros/' + bathroom.id);
  await expect(page.getByRole('heading', { name: 'Café do Centro', exact: true })).toBeVisible();
  await expect(page.locator('.map-marker.is-selected')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('link', { name: 'Voltar aos resultados', exact: true }).click();
  const card = page.getByRole('link', { name: /Café do Centro/ }); await card.hover();
  await expect(page.getByRole('button', { name: 'Café do Centro', exact: true })).toHaveClass(/is-highlighted/);
  await context.grantPermissions(['geolocation']); await context.setGeolocation({ latitude: -23.5668, longitude: -46.6501 });
  await page.getByRole('button', { name: 'Usar minha localização', exact: true }).click();
  await expect(page.locator('.card-distance').first()).toBeVisible();
  await page.evaluate(() => { const runtime = window as unknown as { ng: { getComponent(element: Element | null): { map: { jumpTo(options: object): void } } } }; runtime.ng.getComponent(document.querySelector('app-map')).map.jumpTo({ center: [-46.6558, -23.5535], zoom: 17 }); });
  await page.getByRole('button', { name: 'Buscar nesta área', exact: true }).click();
  await expect(page.getByText('1 banheiro encontrado', { exact: true })).toBeVisible();
  await expect(page.locator('.card-distance')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  const map = page.locator('.workspace-map'); const panel = page.locator('.workspace-panel');
  await expect(map).toBeInViewport(); await expect(panel).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('link', { name: /Café do Centro/ }).click();
  await expect(map).toBeInViewport(); await expect(page.getByRole('heading', { name: 'Café do Centro', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Como chegar', exact: true }).click();
  await expect(map).toBeInViewport(); await expect(page.getByRole('radio', { name: 'Carro', exact: true })).toBeVisible();
  await page.screenshot({ path: '../test-results/workspace-mobile-route.png', fullPage: true });
});

test('nearby bathroom markers cluster and expand without replacing the official pins', async ({ page }) => {
  const bathrooms = await (await page.request.get('/api/bathrooms')).json();
  await page.route(url => url.pathname === '/api/bathrooms', route => route.fulfill({ json: bathrooms.map((bathroom: object, index: number) => ({ ...bathroom, latitude: -23.5535 + index * 0.00001, longitude: -46.6558 + index * 0.00001 })) }));
  await page.goto('/'); await expect(page.getByRole('button', { name: 'Ampliar grupo de 3 banheiros', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ampliar grupo de 3 banheiros', exact: true }).click();
  await expect(page.locator('.map-marker')).toHaveCount(3);
  await expect(page.locator('.map-marker img').first()).toHaveAttribute('src', /assets\/brand\/khki-pin.png$/);
});

test('sidebar overlays a full-size map and selection flies without replacing map or pins', async ({ page }) => {
  let styles = 0; page.on('request', request => { if (request.url().includes('/styles/positron/style.json')) styles++; });
  await page.goto('/'); await expect(page.locator('.map-marker')).toHaveCount(3);
  const canvas = await page.locator('.maplibregl-canvas').elementHandle(); const pin = await page.getByRole('button', { name: 'Café do Centro', exact: true }).elementHandle();
  const before = await page.locator('.maplibregl-canvas').boundingBox(); const workspace = await page.locator('.map-workspace').boundingBox(); const panel = await page.locator('.workspace-panel').boundingBox();
  expect(before!.x).toBe(workspace!.x); expect(before!.width).toBe(workspace!.width); expect(panel!.x).toBe(before!.x);
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--motion-map-duration', '.6s');
    const runtime = window as unknown as { ng: { getComponent(element: Element | null): { map: { on(name: string, callback: () => void): void } } }; flight: { started: number; ended: number; elapsed: number } };
    runtime.flight = { started: 0, ended: 0, elapsed: 0 }; const map = runtime.ng.getComponent(document.querySelector('app-map')).map;
    map.on('movestart', () => { runtime.flight.started = performance.now(); }); map.on('moveend', () => { runtime.flight.ended = performance.now(); runtime.flight.elapsed = runtime.flight.ended - runtime.flight.started; });
  });
  await page.getByRole('link', { name: /Café do Centro/ }).click();
  await expect(page.getByRole('heading', { name: 'Café do Centro', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { flight: { elapsed: number } }).flight.elapsed)).toBeGreaterThan(200);
  expect(await pin!.evaluate(element => element === document.querySelector('.map-marker.is-selected'))).toBe(true);
  expect(await canvas!.evaluate(element => element === document.querySelector('.maplibregl-canvas'))).toBe(true);
  await page.getByRole('link', { name: 'Como chegar', exact: true }).click();
  expect(await pin!.evaluate(element => element === document.querySelector('.map-marker.is-selected'))).toBe(true);
  expect(await page.locator('.maplibregl-canvas').boundingBox()).toEqual(before);
  await page.getByRole('button', { name: 'Recolher painel', exact: true }).click();
  expect(await page.locator('.maplibregl-canvas').boundingBox()).toEqual(before);
  await page.getByRole('button', { name: 'Reabrir painel', exact: true }).click();
  expect(await page.locator('.maplibregl-canvas').boundingBox()).toEqual(before);
  expect(styles).toBe(1);
});
