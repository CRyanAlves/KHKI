import { expect, test } from '@playwright/test';
const simulation = process.env['KHKI_MAPS_SIMULATION_URL'];
test.beforeEach(async ({ page }) => {
  test.skip(!simulation, 'Execute npm test para iniciar os serviços isolados.');
  await page.route('**/config.js', (route) => route.fulfill({ contentType: 'application/javascript', body: `window.KHKI_CONFIG = ${JSON.stringify({ geoapifyApiKey: 'simulation-key', geoapifyApiBaseUrl: simulation + '/v1', geoapifyMapsBaseUrl: simulation + '/v1' })};` }));
});
test('search controls stay fixed while result rows scroll with photos on the right', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 650 });
  await page.goto('/');
  const rows = page.locator('.bathroom-card');
  await expect(rows).toHaveCount(3);
  await expect(page.getByText('Seu próximo alívio')).toHaveCount(0);
  await expect(page.getByPlaceholder('Buscar banheiro ou endereço')).toBeVisible();
  const field = await page.locator('.search-field').boundingBox();
  const body = await rows.first().locator('.card-body').boundingBox();
  const photo = await rows.first().locator('.card-photo').boundingBox();
  expect(photo!.x).toBeGreaterThan(body!.x + body!.width - 1);
  expect(photo!.width).toBeGreaterThanOrEqual(80);
  expect(photo!.width).toBeLessThanOrEqual(96);
  await page.locator('.result-list').evaluate((el) => {
    el.scrollTop = 200;
  });
  expect(await page.locator('.result-list').evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  expect(await page.locator('.search-field').boundingBox()).toEqual(field);
  expect(await page.locator('.workspace-panel').evaluate((el) => el.scrollTop)).toBe(0);
  expect(await page.evaluate(() => scrollY)).toBe(0);
});
test('real result metadata, selection and scroll survive detail return and marker hover', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: -23.5668, longitude: -46.6501 });
  await page.goto('/');
  await expect(page.locator('.bathroom-card')).toHaveCount(3);
  await expect(page.locator('.card-distance').first()).toContainText('em linha reta');
  const canvas = await page.locator('.maplibregl-canvas').elementHandle();
  await page.getByRole('button', { name: 'Café do Centro', exact: true }).click();
  await page.getByRole('link', { name: 'Fechar detalhes', exact: true }).click();
  const selected = page.locator('.bathroom-card.is-selected');
  await expect(selected).toHaveAttribute('aria-current', 'true');
  await expect(selected).toContainText('Café do Centro');
  await selected.hover();
  await expect(page.getByRole('button', { name: 'Café do Centro', exact: true })).toHaveClass(/is-highlighted/);
  expect(await canvas!.evaluate((el) => el === document.querySelector('.maplibregl-canvas'))).toBe(true);
});
test('partial stars, missing reviews, unknown accessibility and failed photos stay truthful', async ({ page }) => {
  await page.route(/\/api\/bathrooms(?:\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const rows = await response.json();
    rows[0] = { ...rows[0], rating: 3.4, reviewCount: 5, accessible: null, items: [], photoIds: ['missing-photo'], demo: true, access: 'PAID', hours: 'Todos os dias, 5h às 23h' };
    rows[1] = { ...rows[1], rating: null, reviewCount: 0, photoIds: [] };
    await route.fulfill({ response, json: rows });
  });
  await page.route('**/api/photos/missing-photo', (route) => route.fulfill({ status: 404 }));
  await page.goto('/');
  const row = page.locator('.bathroom-card').filter({ hasText: 'Foto indisponível' });
  await expect(row).toBeVisible();
  await expect(row.locator('.card-stars-filled')).toHaveAttribute('style', /68%/);
  await expect(row.getByRole('img', { name: 'Acessível', exact: true })).toHaveCount(0);
  await expect(row).toContainText('Com taxa');
  await expect(row).not.toContainText('Demonstração');
  await expect(page.getByText('Sem avaliações', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Sem foto publicada', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Aberto agora', { exact: false })).toHaveCount(0);
});
test('search Enter, clearing and empty/error recovery preserve filters and sorting', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.bathroom-card')).toHaveCount(3);
  await page.getByRole('combobox', { name: 'Ordenação' }).selectOption('rating');
  await page.getByRole('button', { name: 'Filtros', exact: true }).click();
  await page.getByRole('combobox', { name: 'Condição de acesso', exact: true }).selectOption('FREE');
  const input = page.getByPlaceholder('Buscar banheiro ou endereço');
  await input.fill('lugar inexistente xyz');
  await input.press('Enter');
  await expect(page.getByText('Ainda não encontramos um lugar aqui')).toBeVisible();
  await page.getByRole('button', { name: 'Limpar busca', exact: true }).click();
  await expect(input).toHaveValue('');
  await expect(page.locator('.bathroom-card')).toHaveCount(2);
  await expect(page.getByRole('combobox', { name: 'Ordenação' })).toHaveValue('rating');
  await expect(page.getByRole('combobox', { name: 'Condição de acesso', exact: true })).toHaveValue('FREE');
  await page.route('**/api/bathrooms?**', (route) => route.fulfill({ status: 503, json: { message: 'Serviço indisponível' } }));
  await input.press('Enter');
  await expect(page.getByText('Não conseguimos carregar os locais')).toBeVisible();
  await page.unroute('**/api/bathrooms?**');
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page.locator('.bathroom-card')).toHaveCount(2);
});
test('mobile and both themes keep the same map and avoid horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.bathroom-card')).toHaveCount(3);
  const canvas = await page.locator('.maplibregl-canvas').elementHandle();
  for (const mode of ['escuro', 'claro']) {
    await page.getByRole('button', { name: 'Abrir sua conta', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Sua conta', exact: true })
      .getByRole('button', { name: mode === 'escuro' ? 'Escuro' : 'Claro', exact: true })
      .click();
    await page.getByRole('button', { name: 'Fechar conta', exact: true }).click();
    await expect(page.locator('.map-loading')).toHaveCount(0);
    expect(await page.locator('.result-list').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole('button', { name: 'Filtros', exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Expandir painel', exact: true }).click();
  await page.getByRole('button', { name: 'Expandir painel', exact: true }).click();
  await page.getByRole('button', { name: 'Recolher painel', exact: true }).click();
  await expect(page.locator('.map-workspace')).toHaveClass(/mobile-sheet-peek/);
  await expect(page.locator('.workspace-panel')).toBeVisible();
  expect(await canvas!.evaluate((el) => el === document.querySelector('.maplibregl-canvas'))).toBe(true);
});
