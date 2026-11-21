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
  await page.getByRole('textbox', { name: 'Nome do estabelecimento ou espaço', exact: false }).fill(name);
  await page.getByRole('combobox', { name: 'Categoria do local' }).selectOption('Biblioteca');
  await page.getByRole('combobox', { name: 'Endereço completo', exact: false }).fill('Rua Augusta, 1234 — Consolação, São Paulo');
  await page.getByRole('combobox', { name: 'Endereço completo' }).press('Enter');
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

test('three registration steps keep the same map, point, photos and unknown values', async ({ page, browser }) => {
  await login(page);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByText('Informe o nome do local.', { exact: true })).toBeVisible();
  const name = 'Cadastro com mapa ' + Date.now();
  await location(page, name);
  await page.getByRole('textbox', { name: 'Como encontrar o banheiro' }).fill('Piso L2, bloco B');
  await expect(page.getByText('Ajustar coordenadas manualmente', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Verificação de cadastros próximos', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Nome do estabelecimento ou espaço' })).toHaveValue(name);
  await expect.poll(() => page.locator('.registration-map app-map').evaluate((element) => (window as unknown as { ng: { getComponent(element: Element): { map: { isMoving(): boolean } } } }).ng.getComponent(element).map.isMoving())).toBe(false);
  const marker = (await page.locator('.registration-draft-pin').boundingBox())!;
  await page.mouse.move(marker.x + marker.width / 2, marker.y + marker.height / 2);
  await page.mouse.down();
  await page.mouse.move(marker.x + marker.width / 2 + 35, marker.y + marker.height / 2 + 25, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole('combobox', { name: 'Endereço completo' })).toHaveValue('Rua da Posição, 100 — São Paulo, SP');
  const canvas = await page.locator('.maplibregl-canvas').elementHandle();
  const point = await page.locator('.registration-map app-map').evaluate((element) => (window as unknown as { ng: { getComponent(element: Element): { point: object } } }).ng.getComponent(element).point);
  await page.getByRole('button', { name: 'Ativar modo escuro', exact: true }).click();
  await expect(page.getByText('Carregando mapa…', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: '../test-results/registration-dark-location.png', fullPage: true });
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Horário de funcionamento', exact: true })).toHaveValue('unknown');
  await expect(page.getByRole('combobox', { name: 'Acessibilidade geral informada', exact: true }).locator('option:checked')).toHaveText('Não sei informar');
  await page.getByRole('checkbox', { name: 'Papel higiênico', exact: true }).check();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByLabel('Fotos do banheiro', { exact: true }).setInputFiles('../data/demo-regional/images/anexo-01.jpg');
  await page.screenshot({ path: '../test-results/registration-dark-details.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
  await page.getByRole('button', { name: 'Ampliar foto selecionada', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Foto selecionada ampliada' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Como encontrar o banheiro' })).toHaveValue('Piso L2, bloco B');
  expect(await canvas!.evaluate((element) => element === document.querySelector('.maplibregl-canvas'))).toBe(true);
  expect(await page.locator('.registration-map app-map').evaluate((element) => (window as unknown as { ng: { getComponent(element: Element): { point: object } } }).ng.getComponent(element).point)).toEqual(point);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Papel higiênico', exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
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
  await page.getByRole('textbox', { name: 'Nome do estabelecimento ou espaço' }).fill('GPS negado');
  await page.getByRole('combobox', { name: 'Categoria do local' }).selectOption('Outro');
  await page.getByRole('combobox', { name: 'Endereço completo' }).fill('Endereço digitado e preservado');
  await page.getByRole('option', { name: 'Usar minha localização', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Autorize o acesso');
  const panel = await page.locator('.workspace-panel').boundingBox();
  await page.locator('.maplibregl-canvas').click({ position: { x: panel!.width + 150, y: 120 } });
  await expect(page.locator('.registration-draft-pin')).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Endereço completo' })).toHaveValue('Rua da Posição, 100 — São Paulo, SP');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Quem pode usar?' })).toBeVisible();
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
  await expect(page.getByRole('combobox', { name: 'Quem pode usar?' })).toBeDisabled();
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

test('background proximity failure does not expose a technical block or prevent registration', async ({ page }) => {
  await login(page);
  await page.route('**/api/bathrooms/nearby?*', (route) => route.fulfill({ status: 503, json: { detail: 'Consulta temporariamente indisponível.' } }));
  const failure = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/bathrooms/nearby' && response.status() === 503);
  await location(page, 'Consulta de vizinhos ' + Date.now());
  await failure;
  await expect(page.getByText('Verificação de cadastros próximos', { exact: true })).toHaveCount(0);
  await expect(page.locator('.registration-draft-pin')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Horário de funcionamento', exact: true })).toHaveValue('unknown');
});

test('independent usage and charge, observed resources and visit survive review edits and reach moderation', async ({ page }) => {
  await login(page);
  const name = 'Acesso e cobrança ' + Date.now();
  await location(page, name);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Quem pode usar?' })).toHaveValue('UNKNOWN');
  await expect(page.getByRole('combobox', { name: 'Há cobrança?' })).toHaveValue('UNKNOWN');
  await page.getByRole('combobox', { name: 'Quem pode usar?' }).selectOption('CUSTOMERS');
  await page.getByRole('combobox', { name: 'Há cobrança?' }).selectOption('YES');
  await page.getByRole('spinbutton', { name: 'Valor da taxa' }).fill('3.50');
  await page.getByRole('checkbox', { name: 'Feminino', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Masculino', exact: true }).check();
  await page.getByRole('combobox', { name: 'Acesso sem degraus', exact: true }).selectOption({ label: 'Sim' });
  await page.getByRole('combobox', { name: 'Barras de apoio', exact: true }).selectOption({ label: 'Não' });
  await page.screenshot({ path: '../test-results/registration-three-access-light.png', fullPage: true });
  await page.getByRole('button', { name: 'Ativar modo escuro', exact: true }).click();
  await page.screenshot({ path: '../test-results/registration-three-access-dark.png', fullPage: true });
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByLabel('Última visita (opcional)', { exact: true }).fill('2020-02-29');
  await page.getByRole('button', { name: 'Editar Quem pode usar', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Quem pode usar?' })).toHaveValue('CUSTOMERS');
  await expect(page.getByRole('spinbutton', { name: 'Valor da taxa' })).toHaveValue('3.5');
  await expect(page.getByRole('checkbox', { name: 'Feminino', exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByLabel('Última visita (opcional)', { exact: true })).toHaveValue('2020-02-29');
  const sent = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/bathrooms' && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Enviar para análise', exact: true }).click();
  const response = await sent;
  const { id } = await response.json();
  expect(response.request().postDataJSON().access).toBe('CUSTOMERS');
  const own = await (await page.request.get('/api/me/contributions/BATHROOM/' + id)).json();
  expect(own.details).toEqual({ audience: 'CUSTOMERS', charge: 'YES', feeAmount: 3.5, bathroomTypes: ['FEMALE', 'MALE'], stepFreeAccess: true, elevator: null, adaptedCabin: null, grabBars: false, lastVisited: '2020-02-29' });
  await expect(page.getByRole('heading', { name: 'Recebemos seu cadastro', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Moderação', exact: true }).click();
  await page.getByRole('textbox', { name: 'Buscar contribuições' }).fill(name);
  await page.getByRole('button', { name: 'Analisar ' + name, exact: true }).click();
  await expect(page.locator('app-bathroom-metadata')).toContainText('Apenas clientes');
  await expect(page.locator('app-bathroom-metadata')).toContainText('R$');
  await expect(page.locator('app-bathroom-metadata')).toContainText('Feminino, Masculino');
  await expect(page.locator('app-bathroom-metadata')).toContainText('29/02/2020');
});

test('invalid optional fee and future visit stay in the draft until corrected', async ({ page }) => {
  await login(page);
  await location(page, 'Validação opcional ' + Date.now());
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('combobox', { name: 'Há cobrança?' }).selectOption('YES');
  await page.getByRole('spinbutton', { name: 'Valor da taxa' }).fill('-2');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('valor positivo');
  await page.getByRole('combobox', { name: 'Há cobrança?' }).selectOption('UNKNOWN');
  await expect(page.getByRole('spinbutton', { name: 'Valor da taxa' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByLabel('Última visita (opcional)', { exact: true }).fill('2999-01-01');
  await page.getByRole('button', { name: 'Enviar para análise', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('não esteja no futuro');
  await page.getByLabel('Última visita (opcional)', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Enviar para análise', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Recebemos seu cadastro', exact: true })).toBeVisible();
});

test('registration changes only the panel and keeps the map, camera and document in both directions', async ({ page }) => {
  let styles = 0;
  page.on('request', (request) => {
    if (request.url().includes('/styles/positron/style.json')) styles++;
  });
  await login(page);
  await expect(page.locator('.registration-scene')).toBeVisible();
  await expect.poll(() => page.locator('app-map').evaluate((element) => (window as unknown as { ng: { getComponent(element: Element): { loading: boolean } } }).ng.getComponent(element).loading)).toBe(false);
  const canvas = await page.locator('.maplibregl-canvas').elementHandle();
  const timeOrigin = await page.evaluate(() => performance.timeOrigin);
  const camera = await page.locator('app-map').evaluate((element) => {
    const map = (window as unknown as { ng: { getComponent(element: Element): { map: { jumpTo(options: object): void; getCenter(): { lat: number; lng: number }; getZoom(): number } } } }).ng.getComponent(element).map;
    map.jumpTo({ center: [-47.2, -23.1], zoom: 13.5 });
    return { lat: map.getCenter().lat, lng: map.getCenter().lng, zoom: map.getZoom() };
  });
  const initialStyles = styles;
  for (const label of ['Explorar', 'Cadastrar banheiro', 'Explorar']) {
    await page.getByRole('link', { name: label, exact: true }).click();
    await expect(page.locator(label === 'Cadastrar banheiro' ? '.registration-scene' : '.search-scene')).toBeVisible();
    expect(await canvas!.evaluate((element) => element === document.querySelector('.maplibregl-canvas'))).toBe(true);
    const current = await page.locator('app-map').evaluate((element) => {
      const map = (window as unknown as { ng: { getComponent(element: Element): { map: { getCenter(): { lat: number; lng: number }; getZoom(): number } } } }).ng.getComponent(element).map;
      return { lat: map.getCenter().lat, lng: map.getCenter().lng, zoom: map.getZoom() };
    });
    expect(current).toEqual(camera);
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
    expect(styles).toBe(initialStyles);
    await expect(page.locator('app-map')).toHaveCount(1);
  }
});

test('registration address shares the route selector with keyboard suggestions, map selection and clearing', async ({ page }) => {
  await login(page);
  await page.getByRole('textbox', { name: 'Nome do estabelecimento ou espaço' }).fill('Seletor de endereço');
  await page.getByRole('combobox', { name: 'Categoria do local' }).selectOption('Biblioteca');
  const address = page.getByRole('combobox', { name: 'Endereço completo' });
  const canvas = await page.locator('.maplibregl-canvas').elementHandle();
  await address.fill('Rua de teste');
  await expect(page.getByRole('option', { name: 'Rua de teste São Paulo — SP', exact: true })).toBeVisible();
  await expect(page.locator('.registration-location-action')).toHaveCount(0);
  await address.press('ArrowDown');
  await address.press('ArrowDown');
  await address.press('ArrowDown');
  await address.press('Enter');
  await expect(address).toHaveValue('Rua de teste');
  await expect(page.locator('.registration-draft-pin')).toBeVisible();
  await address.click();
  await page.getByRole('option', { name: 'Marcar entrada no mapa', exact: true }).click();
  await expect(page.locator('.workspace-map .route-picking-tools')).toContainText('definir a entrada');
  await page.locator('.workspace-map .route-picking-tools').getByRole('button', { name: 'Cancelar seleção', exact: true }).click();
  await expect(page.locator('.workspace-map .route-picking-tools')).toHaveCount(0);
  await address.click();
  await page.getByRole('option', { name: 'Marcar entrada no mapa', exact: true }).click();
  const panel = await page.locator('.workspace-panel').boundingBox();
  await page.locator('.maplibregl-canvas').click({ position: { x: panel!.width + 150, y: 250 } });
  await expect(page.locator('.workspace-map .route-picking-tools')).toHaveCount(0);
  await expect(address).toHaveValue('Rua da Posição, 100 — São Paulo, SP');
  expect(await canvas!.evaluate((element) => element === document.querySelector('.maplibregl-canvas'))).toBe(true);
  await page.getByRole('button', { name: 'Limpar endereço', exact: true }).click();
  await expect(address).toHaveValue('');
  await address.press('Escape');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Informe o endereço' })).toBeVisible();
});

test('registration GPS in the selector fills the address from the selected position', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.permissions, 'query', { configurable: true, value: () => Promise.resolve({ state: 'prompt' }) });
    Object.defineProperty(navigator.geolocation, 'getCurrentPosition', { configurable: true, value: (success: PositionCallback) => success({ coords: { latitude: -23.556, longitude: -46.658, accuracy: 5 }, timestamp: Date.now() } as GeolocationPosition) });
  });
  await login(page);
  const address = page.getByRole('combobox', { name: 'Endereço completo' });
  await address.fill('Endereço informado pelo usuário');
  await page.getByRole('option', { name: 'Usar minha localização', exact: true }).click();
  await expect(page.locator('.registration-draft-pin')).toBeVisible();
  await expect(address).toHaveValue('Rua da Posição, 100 — São Paulo, SP');
  await expect(address).toHaveAttribute('aria-expanded', 'false');
});

for (const scenario of ['unavailable', 'empty'])
  test('reverse address ' + scenario + ' preserves the point and permits manual correction', async ({ page }) => {
    await login(page);
    await location(page, 'Endereço por posição');
    const address = page.getByRole('combobox', { name: 'Endereço completo' });
    await page.route('**/v1/geocode/reverse?*', (route) => {
      const url = new URL(route.request().url());
      url.searchParams.set('simulationScenario', scenario);
      return route.continue({ url: url.href });
    });
    const panel = await page.locator('.workspace-panel').boundingBox();
    await page.locator('.maplibregl-canvas').click({ position: { x: panel!.width + 150, y: 250 } });
    await expect(page.getByRole('alert').filter({ hasText: 'O ponto foi mantido' })).toBeVisible();
    await expect(page.locator('.registration-draft-pin')).toBeVisible();
    await address.fill('Endereço corrigido manualmente');
    await address.press('Escape');
    await page.getByRole('button', { name: 'Confirmar este ponto para o endereço informado' }).click();
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'Quem pode usar?' })).toBeVisible();
  });

test('late reverse address never overwrites a manual edit', async ({ page }) => {
  await login(page);
  await location(page, 'Resposta atrasada');
  await page.route('**/v1/geocode/reverse?*', (route) => {
    const url = new URL(route.request().url());
    url.searchParams.set('simulationScenario', 'slow');
    return route.continue({ url: url.href });
  });
  const reverse = page.waitForRequest((request) => new URL(request.url()).pathname.endsWith('/geocode/reverse'));
  const panel = await page.locator('.workspace-panel').boundingBox();
  await page.locator('.maplibregl-canvas').click({ position: { x: panel!.width + 150, y: 250 } });
  await reverse;
  const address = page.getByRole('combobox', { name: 'Endereço completo' });
  await address.fill('Correção durante a consulta');
  await address.press('Escape');
  await page.waitForTimeout(3200);
  await expect(address).toHaveValue('Correção durante a consulta');
  await expect(page.getByText('Buscando endereço da posição…', { exact: true })).toHaveCount(0);
});
