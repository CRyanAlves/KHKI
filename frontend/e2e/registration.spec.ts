import { expect, Page, test } from '@playwright/test';

async function login(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('link', { name: 'Cadastrar banheiro', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('E-mail', { exact: true }).fill(process.env['KHKI_TEST_ADMIN_EMAIL']!);
  await dialog.getByLabel('Senha', { exact: true }).fill(process.env['KHKI_TEST_ADMIN_PASSWORD']!);
  await dialog.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/cadastrar$/);
}
async function location(page: Page, name: string): Promise<void> {
  await page.getByRole('textbox', { name: 'Nome do local', exact: false }).fill(name);
  await page.getByRole('textbox', { name: 'Endereço completo', exact: false }).fill('Rua Augusta, 1234 — Consolação, São Paulo');
  await page.getByRole('button', { name: 'Localizar endereço no mapa', exact: true }).click();
  await expect(page.locator('.registration-draft-pin')).toBeVisible();
}
async function contributions(page: Page): Promise<{ id: string; title: string; type: string; bathroomId: string }[]> {
  return (await page.request.get('/api/me/contributions')).json();
}

test.beforeEach(async ({ page }) => {
  test.skip(!process.env['KHKI_TEST_ADMIN_PASSWORD'] || !process.env['KHKI_MAPS_SIMULATION_URL'], 'Execute npm test para iniciar serviços isolados.');
  const simulation = process.env['KHKI_MAPS_SIMULATION_URL'];
  await page.route('**/config.js', (route) => route.fulfill({ contentType: 'application/javascript', body: `window.KHKI_CONFIG = ${JSON.stringify({ geoapifyApiKey: 'simulation-key', geoapifyApiBaseUrl: simulation + '/v1', geoapifyMapsBaseUrl: simulation + '/v1' })};` }));
});

test('two registration steps keep the same map, point, photos and unknown values', async ({ page, browser }) => {
  await login(page);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByText('Informe o nome do local.', { exact: true })).toBeVisible();
  const name = 'Cadastro com mapa ' + Date.now();
  await location(page, name);
  await page.getByRole('textbox', { name: 'Complemento ou localização interna' }).fill('Piso L2, bloco B');
  await page.getByRole('combobox', { name: 'Raio de proximidade' }).selectOption({ label: '1 km' });
  await expect(page.getByRole('button', { name: 'Ver cadastro', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ver cadastro', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Cadastro existente' })).toContainText('Café do Centro');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('textbox', { name: 'Nome do local' })).toHaveValue(name);
  await expect.poll(() => page.locator('.registration-map app-map').evaluate((element) => (window as unknown as { ng: { getComponent(element: Element): { map: { isMoving(): boolean } } } }).ng.getComponent(element).map.isMoving())).toBe(false);
  const marker = (await page.locator('.registration-draft-pin').boundingBox())!;
  await page.mouse.move(marker.x + marker.width / 2, marker.y + marker.height / 2);
  await page.mouse.down();
  await page.mouse.move(marker.x + marker.width / 2 + 35, marker.y + marker.height / 2 + 25, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole('textbox', { name: 'Endereço completo' })).toHaveValue('Rua Augusta, 1234 — Consolação, São Paulo');
  const canvas = await page.locator('.maplibregl-canvas').elementHandle();
  const point = await page.locator('.registration-map app-map').evaluate((element) => (window as unknown as { ng: { getComponent(element: Element): { point: object } } }).ng.getComponent(element).point);
  await page.getByRole('button', { name: 'Ativar modo escuro', exact: true }).click();
  await expect(page.getByText('Carregando mapa…', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: '../test-results/registration-dark-location.png', fullPage: true });
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Horário de funcionamento', exact: true })).toHaveValue('unknown');
  await expect(page.getByRole('combobox', { name: 'Acessibilidade', exact: true }).locator('option:checked')).toHaveText('Não sei informar');
  await page.getByRole('checkbox', { name: 'Papel higiênico', exact: true }).check();
  await page.getByLabel('Fotos do banheiro', { exact: true }).setInputFiles('../data/demo-regional/images/anexo-01.jpg');
  await page.screenshot({ path: '../test-results/registration-dark-details.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
  await page.getByRole('button', { name: 'Ampliar foto selecionada', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Foto selecionada ampliada' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Complemento ou localização interna' })).toHaveValue('Piso L2, bloco B');
  expect(await canvas!.evaluate((element) => element === document.querySelector('.maplibregl-canvas'))).toBe(true);
  expect(await page.locator('.registration-map app-map').evaluate((element) => (window as unknown as { ng: { getComponent(element: Element): { point: object } } }).ng.getComponent(element).point)).toEqual(point);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Papel higiênico', exact: true })).toBeChecked();
  await expect(page.getByRole('img', { name: 'Foto selecionada para análise' })).toBeVisible();
  await page.getByRole('button', { name: 'Ativar modo claro', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '../test-results/registration-mobile-details.png', fullPage: true });
  const sent = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/bathrooms' && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Enviar para análise', exact: true }).click();
  const response = await sent;
  const bathroom = await response.json();
  expect(bathroom.status).toBe('PENDING');
  const payload = response.request().postDataJSON();
  expect(payload.hours).toBe('');
  expect(payload.accessible).toBeNull();
  await expect(page.getByRole('heading', { name: 'Recebemos seu cadastro', exact: true })).toBeVisible();
  const photos = (await contributions(page)).filter((value) => value.type === 'PHOTO' && value.bathroomId === bathroom.id);
  expect(photos).toHaveLength(1);
  const visitor = await browser.newContext();
  expect((await visitor.request.get(new URL('/api/bathrooms/' + bathroom.id, page.url()).href)).status()).toBe(404);
  expect((await visitor.request.get(new URL('/api/photos/' + photos[0].id, page.url()).href)).status()).toBe(404);
  await visitor.close();
});

test('denied GPS does not block a manual point and leaving a draft asks for confirmation', async ({ page }) => {
  await page.addInitScript(() => {
    const runtime = window as unknown as { registrationGpsCalls: number };
    runtime.registrationGpsCalls = 0;
    Object.defineProperty(navigator.geolocation, 'getCurrentPosition', {
      value: (_success: PositionCallback, failure: PositionErrorCallback) => {
        runtime.registrationGpsCalls++;
        failure({ code: 1 } as GeolocationPositionError);
      }
    });
  });
  await login(page);
  expect(await page.evaluate(() => (window as unknown as { registrationGpsCalls: number }).registrationGpsCalls)).toBe(0);
  await page.getByRole('textbox', { name: 'Nome do local' }).fill('GPS negado');
  await page.getByRole('textbox', { name: 'Endereço completo' }).fill('Endereço digitado e preservado');
  await page.getByRole('button', { name: 'Usar minha localização', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Busque um endereço');
  await page.locator('.maplibregl-canvas').click({ position: { x: 250, y: 120 } });
  await expect(page.locator('.registration-draft-pin')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Endereço completo' })).toHaveValue('Endereço digitado e preservado');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Condições de acesso' })).toBeVisible();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('link', { name: 'Explorar', exact: true }).click();
  await expect(page).toHaveURL(/\/cadastrar$/);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('link', { name: 'Explorar', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('lost creation response can be retried without creating a second bathroom', async ({ page }) => {
  await login(page);
  const name = 'Resposta perdida ' + Date.now();
  await location(page, name);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  let requests = 0;
  await page.route(
    (url) => url.pathname === '/api/bathrooms',
    async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      requests++;
      if (requests === 1) {
        await route.fetch();
        await route.abort('failed');
      } else await route.continue();
    }
  );
  await page.route('**/api/me/submissions/*', (route) => route.fulfill({ status: 503, json: { detail: 'Falha de rede simulada.' } }));
  await page.getByRole('button', { name: 'Enviar para análise', exact: true }).click();
  await expect(page.getByText(/Não foi possível confirmar a resposta do envio/)).toBeVisible();
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Nome do local' })).toBeDisabled();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.unroute('**/api/me/submissions/*');
  await page.getByRole('button', { name: 'Enviar para análise', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Recebemos seu cadastro', exact: true })).toBeVisible();
  expect(requests).toBe(2);
  expect((await contributions(page)).filter((value) => value.type === 'BATHROOM' && value.title === name)).toHaveLength(1);
});

test('partial photo upload retries only the missing receipt without duplicating received images', async ({ page }) => {
  await login(page);
  const name = 'Fotos com recuperação ' + Date.now();
  await location(page, name);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByLabel('Fotos do banheiro', { exact: true }).setInputFiles(['../data/demo-regional/images/anexo-01.jpg', '../data/demo-regional/images/anexo-02.jpg']);
  const requests: string[] = [];
  await page.route(
    (url) => /\/api\/bathrooms\/[^/]+\/photos$/.test(url.pathname),
    async (route) => {
      requests.push(route.request().url());
      if (requests.length === 1) {
        await route.fetch();
        await route.abort('failed');
      } else await route.continue();
    }
  );
  await page.getByRole('button', { name: 'Enviar para análise', exact: true }).click();
  await expect(page.getByText(/O cadastro já foi salvo em análise/)).toBeVisible();
  await page.getByRole('button', { name: 'Tentar enviar fotos restantes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Recebemos seu cadastro', exact: true })).toBeVisible();
  expect(requests).toHaveLength(3);
  expect(requests[0]).toBe(requests[2]);
  const rows = await contributions(page);
  const bathroom = rows.find((value) => value.title === name)!;
  expect(rows.filter((value) => value.type === 'PHOTO' && value.bathroomId === bathroom.id)).toHaveLength(2);
});

test('failed proximity lookup is explicit and can recover without clearing the location', async ({ page }) => {
  await login(page);
  await page.route('**/api/bathrooms/nearby?*', (route) => route.fulfill({ status: 503, json: { detail: 'Consulta temporariamente indisponível.' } }));
  await location(page, 'Consulta de vizinhos ' + Date.now());
  await expect(page.getByText(/Consulta indisponível:/)).toBeVisible();
  await expect(page.getByText(/Nenhum candidato encontrado/)).toHaveCount(0);
  await page.unroute('**/api/bathrooms/nearby?*');
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page.getByText(/Nenhum candidato encontrado em até/)).toBeVisible();
  await expect(page.locator('.registration-draft-pin')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Horário de funcionamento', exact: true })).toHaveValue('unknown');
});
