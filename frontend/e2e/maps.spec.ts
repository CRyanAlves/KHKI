import { expect, test } from '@playwright/test';

const simulation = process.env['KHKI_MAPS_SIMULATION_URL'];
test.beforeEach(async ({ page }) => {
  test.skip(!simulation, 'Execute npm test para iniciar a simulação HTTP da Geoapify.');
  await page.route('**/config.js', route => route.fulfill({ contentType: 'application/javascript', body: `window.KHKI_CONFIG = ${JSON.stringify({ geoapifyApiKey: 'simulation-key', geoapifyApiBaseUrl: simulation + '/v1', geoapifyMapsBaseUrl: simulation + '/v1' })};` }));
});

test('Geoapify simulated HTTP: map, geocoding, pedestrian route and attribution', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  await expect(page.locator('.map-marker')).toHaveCount(3);
  await expect(page.getByRole('link', { name: 'Geoapify', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Buscar por nome, endereço ou região' }).fill('Rua de teste, São Paulo');
  await page.getByRole('button', { name: 'Localizar endereço', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Mapa centralizado');
  await page.getByRole('button', { name: 'Café do Centro', exact: true }).click();
  await page.getByRole('link', { name: 'Como chegar', exact: true }).click();
  await page.getByRole('textbox', { name: 'Sua origem' }).fill('Rua de teste, São Paulo');
  await page.getByRole('radio', { name: 'A pé', exact: true }).check();
  await page.getByRole('button', { name: 'Calcular rota', exact: true }).click();
  await expect(page.getByRole('heading', { name: '4 min', exact: true })).toBeVisible();
  await expect(page.getByText('0,3 km a pé', { exact: true })).toBeVisible();
  await expect(page.getByText('Siga pela rua de teste até o destino.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Origem da rota', exact: true })).toBeVisible();
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  const darkStyle = page.waitForResponse(response => response.url().includes('/styles/dark-matter/style.json') && response.ok());
  await page.getByRole('button', { name: 'Ativar modo escuro', exact: true }).click();
  await darkStyle;
  await expect(page.getByText('Carregando mapa…', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Origem da rota', exact: true })).toBeVisible();
  await expect(page.getByText('0,3 km a pé', { exact: true })).toBeVisible();
  await expect(page.locator('.maplibregl-ctrl-group')).toHaveCSS('background-color', 'rgb(21, 39, 47)');
  await expect(page.locator('.maplibregl-ctrl-attrib')).toHaveCSS('background-color', 'rgb(21, 39, 47)');
  await page.screenshot({ path: '../test-results/theme-dark-route.png', fullPage: true });
  const lightStyle = page.waitForResponse(response => response.url().includes('/styles/positron/style.json') && response.ok());
  await page.getByRole('button', { name: 'Ativar modo claro', exact: true }).click();
  await lightStyle;
  await expect(page.getByText('Carregando mapa…', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Origem da rota', exact: true })).toBeVisible();
  await page.screenshot({ path: '../test-results/geoapify-simulation-route.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('Geoapify simulated HTTP: clear errors for quota, missing result and malformed coordinates', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Café do Centro/ }).click();
  await page.getByRole('link', { name: 'Como chegar', exact: true }).click();
  for (const [origin, expected] of [['limite', 'limite de uso'], ['sem resultado', 'Endereço não encontrado'], ['invalido', 'coordenadas inválidas'], ['falha', 'indisponível']]) {
    await page.getByRole('textbox', { name: 'Sua origem' }).fill(origin);
    await page.getByRole('button', { name: 'Calcular rota', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText(expected);
    await expect(page.getByRole('heading', { name: '4 min', exact: true })).toHaveCount(0);
  }
});


test('driving profile uses vehicle routing and changing mode clears the previous result', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Café do Centro/ }).click();
  await page.getByRole('link', { name: 'Como chegar', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Carro', exact: true })).toBeChecked();
  await page.getByRole('textbox', { name: 'Sua origem' }).fill('Rua de teste, São Paulo');
  const driving = page.waitForRequest(request => { const url = new URL(request.url()); return url.pathname.endsWith('/routing') && url.searchParams.get('mode') === 'drive'; });
  await page.getByRole('button', { name: 'Calcular rota', exact: true }).click(); await driving;
  await expect(page.getByText('1,1 km de carro', { exact: true })).toBeVisible();
  await expect(page.getByText('Contorne o quarteirão seguindo o sentido permitido da via simulada.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Origem da rota', exact: true })).toBeVisible();
  await page.screenshot({ path: '../test-results/route-driving.png', fullPage: true });
  await page.getByRole('radio', { name: 'A pé', exact: true }).check();
  await expect(page.getByText('1,1 km de carro', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Origem da rota', exact: true })).toHaveCount(0);
  const walking = page.waitForRequest(request => { const url = new URL(request.url()); return url.pathname.endsWith('/routing') && url.searchParams.get('mode') === 'walk'; });
  await page.getByRole('button', { name: 'Calcular rota', exact: true }).click(); await walking;
  await expect(page.getByText('0,3 km a pé', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Sua origem' }).fill('Outra origem');
  await expect(page.getByText('0,3 km a pé', { exact: true })).toHaveCount(0);
});
