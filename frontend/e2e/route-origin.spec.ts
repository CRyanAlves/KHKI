import { expect, Page, test } from '@playwright/test';

async function openRoute(page: Page): Promise<void> {
  await page.goto('/');
  if ((page.viewportSize()?.width || 0) <= 640) await page.getByRole('button', { name: 'Expandir painel', exact: true }).click();
  await page.locator('.bathroom-card').first().click();
  await page.getByRole('link', { name: 'Como chegar', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Sua origem' })).toBeVisible();
}
const origin = (page: Page) => page.getByRole('combobox', { name: 'Sua origem', exact: true });
async function address(page: Page, text = 'Rua de teste, São Paulo'): Promise<void> {
  await origin(page).fill(text);
  await origin(page).press('Enter');
  await expect(page.locator('.route-summary')).toBeVisible();
}
test.beforeEach(async ({ page }) => {
  test.setTimeout(90000);
  test.skip(!process.env['KHKI_MAPS_SIMULATION_URL'], 'Use npm test para iniciar os serviços HTTP isolados.');
  const base = process.env['KHKI_MAPS_SIMULATION_URL'];
  await page.route('**/config.js', (route) => route.fulfill({ contentType: 'application/javascript', body: `window.KHKI_CONFIG=${JSON.stringify({ geoapifyApiKey: 'simulation-key', geoapifyApiBaseUrl: base + '/v1', geoapifyMapsBaseUrl: base + '/v1' })};` }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('Busca sugestões de origem após a pausa de digitação e calcula a rota por teclado sem alterar mapa ou cabeçalho', async ({ page }) => {
  let searches = 0;
  let routes = 0;
  page.on('request', (request) => {
    if (request.url().includes('/geocode/autocomplete?')) searches++;
    if (request.url().includes('/routing?')) routes++;
  });
  await openRoute(page);
  const header = await page.locator('.site-header').boundingBox();
  const map = await page.locator('app-map').elementHandle();
  await expect(page.getByRole('radio', { name: 'Carro', exact: true })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Calcular rota', exact: true })).toHaveCount(0);
  await origin(page).focus();
  await expect(page.getByRole('option', { name: 'Usar minha localização', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Marcar início no mapa', exact: true })).toBeVisible();
  await origin(page).fill('Ru');
  await page.waitForTimeout(450);
  expect(searches).toBe(0);
  await origin(page).fill('Rua de teste');
  await expect(page.getByRole('option', { name: 'Rua de teste São Paulo — SP', exact: true })).toBeVisible();
  expect(searches).toBe(1);
  expect(routes).toBe(0);
  await origin(page).press('ArrowDown');
  await origin(page).press('ArrowDown');
  await origin(page).press('ArrowDown');
  await origin(page).press('Enter');
  await expect(page.locator('.route-summary')).toContainText('de carro');
  await expect(origin(page)).toHaveValue('Rua de teste');
  expect(routes).toBe(1);
  expect(await map!.evaluate((element) => element === document.querySelector('app-map'))).toBe(true);
  expect(await page.locator('.site-header').boundingBox()).toEqual(header);
  await origin(page).click();
  await origin(page).press('ArrowUp');
  await expect(origin(page)).toHaveAttribute('aria-activedescendant', 'route-origin-option-1');
  await origin(page).press('Escape');
  await expect(origin(page)).toHaveAttribute('aria-expanded', 'false');
  await origin(page).click();
  await page.locator('.route-panel h1').click();
  await expect(origin(page)).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: 'Limpar origem', exact: true }).click();
  await expect(origin(page)).toHaveValue('');
  await expect(page.locator('.route-summary')).toHaveCount(0);
});

for (const denied of [false, true])
  test('Solicita a geolocalização da origem explicitamente e ' + (denied ? 'permite recuperar por endereço após a recusa' : 'calcula a rota automaticamente com as coordenadas'), async ({ page }) => {
    await page.addInitScript(
      ({ denied }) => {
        const state = window as unknown as { originGpsCalls: number };
        state.originGpsCalls = 0;
        Object.defineProperty(navigator.permissions, 'query', { configurable: true, value: () => Promise.resolve({ state: 'prompt' }) });
        Object.defineProperty(navigator.geolocation, 'getCurrentPosition', {
          configurable: true,
          value: (success: PositionCallback, failure: PositionErrorCallback) => {
            state.originGpsCalls++;
            if (denied) failure({ code: 1 } as GeolocationPositionError);
            else success({ coords: { latitude: -23.556, longitude: -46.658, accuracy: 5 }, timestamp: Date.now() } as GeolocationPosition);
          }
        });
      },
      { denied }
    );
    await openRoute(page);
    expect(await page.evaluate(() => (window as unknown as { originGpsCalls: number }).originGpsCalls)).toBe(0);
    await origin(page).focus();
    await page.getByRole('option', { name: 'Usar minha localização', exact: true }).click();
    expect(await page.evaluate(() => (window as unknown as { originGpsCalls: number }).originGpsCalls)).toBe(1);
    if (denied) {
      await expect(page.getByRole('alert')).toContainText('Não foi possível acessar sua localização');
      await address(page);
    } else {
      await expect(origin(page)).toHaveValue('Minha localização');
      await expect(page.locator('.route-summary')).toBeVisible();
    }
  });

test('Permite cancelar a seleção da origem no mapa, aceita um clique e preserva o contexto ao voltar aos detalhes', async ({ page }) => {
  await openRoute(page);
  await address(page);
  const original = await origin(page).inputValue();
  await origin(page).click();
  await page.getByRole('option', { name: 'Marcar início no mapa', exact: true }).click();
  await page.locator('.route-picking-tools').getByRole('button', { name: 'Cancelar seleção' }).click();
  await expect(origin(page)).toHaveValue(original);
  await origin(page).click();
  await page.getByRole('option', { name: 'Marcar início no mapa', exact: true }).click();
  await page.locator('.maplibregl-canvas').click({ position: { x: 1000, y: 300 } });
  await expect(origin(page)).toHaveValue('Ponto marcado no mapa');
  await expect(page.locator('.route-picking-tools')).toHaveCount(0);
  await expect(page.locator('.route-summary')).toBeVisible();
  await page.locator('.maplibregl-canvas').click({ position: { x: 1100, y: 400 } });
  await expect(origin(page)).toHaveValue('Ponto marcado no mapa');
  await page.getByRole('link', { name: 'Voltar aos detalhes', exact: true }).click();
  await expect(page.locator('app-details')).toBeVisible();
  await page.getByRole('link', { name: 'Como chegar', exact: true }).click();
  await expect(origin(page)).toHaveValue('Ponto marcado no mapa');
  await expect(page.locator('.route-summary')).toBeVisible();
});

test('Recalcula os quatro modos de transporte e descarta respostas antigas mais lentas', async ({ page }) => {
  await openRoute(page);
  const profiles: string[] = [];
  await page.route('**/v1/routing*', (route) => {
    const url = new URL(route.request().url());
    const mode = url.searchParams.get('mode')!;
    profiles.push(mode);
    if (mode === 'motorcycle') url.searchParams.set('simulationScenario', 'slow');
    return route.continue({ url: url.toString() });
  });
  await address(page);
  await page.getByRole('radio', { name: 'Moto', exact: true }).click();
  await page.getByRole('radio', { name: 'Bike', exact: true }).click();
  await expect(page.locator('.route-summary')).toContainText('0,7 km de bicicleta');
  await page.waitForTimeout(1700);
  await expect(page.locator('.route-summary')).toContainText('de bicicleta');
  await page.getByRole('radio', { name: 'A pé', exact: true }).click();
  await expect(page.locator('.route-summary')).toContainText('0,3 km a pé');
  await page.getByRole('radio', { name: 'Carro', exact: true }).click();
  await expect(page.locator('.route-summary')).toContainText('1,1 km de carro');
  expect(profiles.filter((mode) => mode === 'drive')).toHaveLength(1);
  expect(profiles).toEqual(expect.arrayContaining(['drive', 'motorcycle', 'bicycle', 'walk']));
});

test('Descarta sugestões atrasadas e preserva o texto em falhas sem tratá-lo como origem válida', async ({ page }) => {
  await openRoute(page);
  await origin(page).fill('lento');
  await page.waitForRequest((request) => request.url().includes('/autocomplete?'));
  await origin(page).fill('Mercado');
  await expect(page.getByRole('option', { name: 'Mercado São Paulo — SP', exact: true })).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.getByRole('option', { name: /^lento/ })).toHaveCount(0);
  await origin(page).fill('limite');
  await expect(page.getByRole('alert')).toContainText('limite de uso');
  await expect(origin(page)).toHaveValue('limite');
  await expect(page.locator('.route-summary')).toHaveCount(0);
  await origin(page).fill('invalido');
  await expect(page.getByRole('alert')).toContainText('coordenadas inválidas');
  await address(page);
});

test('Preserva a origem após falha no cálculo automático e oferece nova tentativa contextual', async ({ page }) => {
  await openRoute(page);
  let requests = 0;
  await page.route('**/v1/routing*', (route) => {
    const url = new URL(route.request().url());
    if (++requests === 1) url.searchParams.set('simulationScenario', 'unavailable');
    return route.continue({ url: url.toString() });
  });
  await origin(page).fill('Praça Central');
  await origin(page).press('Enter');
  await expect(page.getByRole('alert')).toContainText('indisponível');
  await expect(origin(page)).toHaveValue('Praça Central');
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page.locator('.route-summary')).toBeVisible();
  await origin(page).fill('Novo texto não selecionado');
  await expect(page.locator('.route-summary')).toHaveCount(0);
  expect(requests).toBe(2);
});

test('Preserva uma origem válida ao trocar o destino e calcula a nova rota automaticamente', async ({ page }) => {
  await openRoute(page);
  await address(page);
  const bathrooms = (await (await page.request.get('/api/bathrooms')).json()) as { id: string; name: string; latitude: number; longitude: number }[];
  const selected = await page.locator('.destination-box strong').innerText();
  const next = bathrooms.find((bathroom) => bathroom.name !== selected)!;
  const request = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname.endsWith('/routing') && url.searchParams.get('waypoints')?.endsWith('|' + next.latitude + ',' + next.longitude) === true;
  });
  await page.locator('app-workspace').evaluate((element, id) => {
    const component = (window as unknown as { ng: { getComponent(element: Element): { router: { navigate(commands: string[]): Promise<boolean> } } } }).ng.getComponent(element);
    return component.router.navigate(['/banheiros', id, 'rota']);
  }, next.id);
  await request;
  await expect(page.locator('.route-summary')).toBeVisible();
  await expect(origin(page)).toHaveValue('Rua de teste, São Paulo');
  await expect(page.locator('.destination-box strong')).toHaveText(next.name);
});

test('Retoma uma rota pendente ao cancelar a seleção no mapa sem perder a origem confirmada', async ({ page }) => {
  await openRoute(page);
  let count = 0;
  await page.route('**/v1/routing*', (route) => {
    const url = new URL(route.request().url());
    if (++count === 1) url.searchParams.set('simulationScenario', 'slow');
    return route.continue({ url: url.toString() });
  });
  await origin(page).fill('Rua de teste');
  const pending = page.waitForRequest((request) => new URL(request.url()).pathname.endsWith('/routing'));
  await origin(page).press('Enter');
  await pending;
  await origin(page).click();
  await page.getByRole('option', { name: 'Marcar início no mapa', exact: true }).click();
  await page.locator('.route-picking-tools').getByRole('button', { name: 'Cancelar seleção' }).click();
  await expect(page.locator('.route-summary')).toBeVisible();
  await expect(origin(page)).toHaveValue('Rua de teste');
});

test('Sobrepõe as sugestões de origem ao painel nos dois temas e permite selecionar no mapa pelo teclado no celular', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openRoute(page);
  for (const dark of [false, true]) {
    if (dark) {
      await page.getByRole('button', { name: 'Recolher painel', exact: true }).click();
      await page.getByRole('button', { name: 'Abrir sua conta', exact: true }).click();
      await page.getByRole('button', { name: 'Aparência', exact: true }).click();
      await page.getByRole('radio', { name: 'Escuro', exact: true }).check();
      await page.getByRole('button', { name: 'Fechar conta', exact: true }).click();
    }
    const map = await page.locator('.workspace-map').boundingBox();
    await origin(page).focus();
    await origin(page).fill('Rua de teste');
    await expect(page.getByRole('option', { name: 'Rua de teste São Paulo — SP', exact: true })).toBeVisible();
    const field = await page.locator('.origin-field').boundingBox();
    const popup = await page.getByRole('listbox').boundingBox();
    expect(Math.abs(popup!.y - (field!.y + field!.height))).toBeLessThan(8);
    expect(await page.locator('.workspace-map').boundingBox()).toEqual(map);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: '../test-results/route-origin-' + (dark ? 'dark' : 'light') + '-mobile.png' });
    await origin(page).press('Escape');
    await expect(page.getByRole('listbox')).toHaveCount(0);
  }
  await origin(page).click();
  await page.getByRole('option', { name: 'Marcar início no mapa', exact: true }).click();
  await expect(page.locator('.workspace-panel')).toBeHidden();
  await page.getByRole('button', { name: 'Usar centro do mapa', exact: true }).click();
  await expect(page.locator('.workspace-panel')).toBeVisible();
  await expect(page.locator('.route-summary')).toBeVisible();
});
