import { expect, Page, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const simulation = process.env['KHKI_MAPS_SIMULATION_URL'];
test.use({ viewport: { width: 393, height: 852 }, hasTouch: true });
test.beforeEach(async ({ page }) => {
  test.skip(!simulation, 'Execute npm test para iniciar os serviços isolados.');
  await page.route('**/config.js', (route) => route.fulfill({ contentType: 'application/javascript', body: `window.KHKI_CONFIG = ${JSON.stringify({ geoapifyApiKey: 'simulation-key', geoapifyApiBaseUrl: simulation + '/v1', geoapifyMapsBaseUrl: simulation + '/v1', devRouteSimulation: false })};` }));
});
async function expand(page: Page, count = 1): Promise<void> {
  for (let index = 0; index < count; index++) await page.getByRole('button', { name: 'Expandir painel', exact: true }).click();
  await page.waitForTimeout(320);
}
async function selectBathroom(page: Page): Promise<void> {
  await page.goto('/');
  await expand(page);
  await page.locator('.bathroom-card').first().click();
  await expect(page.locator('.details-panel h1')).toBeVisible();
}
async function drag(page: Page, selector: string, delta: number): Promise<void> {
  await page.locator(selector).evaluate((element, delta) => {
    const rect = element.getBoundingClientRect();
    const point = { identifier: 1, target: element, clientX: rect.x + rect.width / 2, clientY: rect.y + 8 };
    element.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [new Touch(point)] }));
    element.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: [new Touch({ ...point, clientY: point.clientY + delta })] }));
    element.dispatchEvent(new TouchEvent('touchend', { bubbles: true, changedTouches: [new Touch({ ...point, clientY: point.clientY + delta })] }));
  }, delta);
  await page.waitForTimeout(320);
}

test('three sheet stops, direct dragging, list scroll, safe navigation and full size map', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Navegação mobile' })).toBeVisible();
  await expect(page.locator('.map-workspace')).toHaveClass(/mobile-sheet-peek/);
  const map = await page.locator('.maplibregl-canvas').elementHandle();
  const initial = (await page.locator('.workspace-panel').boundingBox())!.height;
  await page.screenshot({ path: '../test-results/mobile-new-peek.png' });
  await expand(page);
  const middle = (await page.locator('.workspace-panel').boundingBox())!.height;
  await page.screenshot({ path: '../test-results/mobile-new-middle.png' });
  expect(middle).toBeGreaterThan(initial * 2);
  await expand(page);
  await expect(page.locator('.map-workspace')).toHaveClass(/mobile-sheet-full/);
  const full = (await page.locator('.workspace-panel').boundingBox())!.height;
  expect(full).toBeGreaterThan(middle);
  await page.locator('.result-list').evaluate((element) => (element.scrollTop = 100));
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  const bounds = await page.locator('.workspace-map').boundingBox();
  expect(bounds!.height).toBeGreaterThan(700);
  await page.locator('.result-list').evaluate((element) => (element.scrollTop = 0));
  await drag(page, '.result-list', 700);
  await expect(page.locator('.map-workspace')).toHaveClass(/mobile-sheet-peek/);
  await drag(page, '.mobile-sheet-handle', -600);
  await expect(page.locator('.map-workspace')).toHaveClass(/mobile-sheet-full/);
  expect(await map!.evaluate((element) => element === document.querySelector('.maplibregl-canvas'))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '../test-results/mobile-new-explore.png' });
});

test('details restore list height and scroll, keep selected pin, and gallery swipes full screen', async ({ page }) => {
  const rows = await (await page.request.get('/api/bathrooms')).json();
  await page.route('**/api/bathrooms/' + rows[0].id, async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...(await response.json()), photoIds: ['mobile-test-one', 'mobile-test-two'] } });
  });
  await page.route('**/api/photos/mobile-test-*', (route) => route.fulfill({ contentType: 'image/jpeg', body: readFileSync('../data/demo-regional/images/anexo-01.jpg') }));
  await selectBathroom(page);
  await expect(page.getByRole('navigation', { name: 'Navegação mobile' })).toHaveCount(0);
  await expect(page.locator('.map-marker.is-selected')).toBeVisible();
  await expect(page.locator('.gallery')).toBeHidden();
  await expand(page);
  await expect(page.locator('.mobile-detail-photos')).toBeVisible();
  await page.screenshot({ path: '../test-results/mobile-new-details.png' });
  const title = await page.locator('.details-panel h1').innerText();
  await page.getByRole('tab', { name: /^Fotos/ }).click();
  await page.getByRole('button', { name: 'Ver foto 1', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Fotos do banheiro' })).toBeVisible();
  await expect(page.locator('.site-header')).toBeHidden();
  await expect(page.locator('.photo-panels')).toBeHidden();
  const viewer = await page.locator('app-map-photo-viewer').boundingBox();
  expect(viewer!.height).toBe(852);
  const count = await page.locator('.photo-count').innerText();
  await page.locator('.photo-viewer-frame').evaluate((element) => {
    const point = { identifier: 1, target: element, clientX: 300, clientY: 300 };
    element.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [new Touch(point)] }));
    element.dispatchEvent(new TouchEvent('touchend', { bubbles: true, changedTouches: [new Touch({ ...point, clientX: 100 })] }));
  });
  await expect(page.locator('.photo-count')).not.toHaveText(count);
  await page.screenshot({ path: '../test-results/mobile-new-gallery.png' });
  await page.getByRole('button', { name: 'Voltar ao mapa', exact: true }).click();
  await expect(page.locator('.details-panel h1')).toHaveText(title);
  await expect(page.locator('.map-workspace')).toHaveClass(/mobile-sheet-full/);
  await page.getByRole('link', { name: 'Fechar detalhes', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Navegação mobile' })).toBeVisible();
  await expect(page.locator('.map-workspace')).not.toHaveClass(/mobile-sheet-full|mobile-sheet-peek/);
});

test('mobile search suggestions, keyboard, clearing, error and navigation visibility', async ({ page }) => {
  await page.goto('/');
  const input = page.getByRole('combobox', { name: 'Buscar banheiro ou endereço' });
  await input.fill('Cafe');
  await expect(page.getByRole('navigation', { name: 'Navegação mobile' })).toHaveCount(0);
  await expect(page.getByRole('option', { name: /Café do Centro/ })).toBeVisible();
  await input.press('ArrowUp');
  await expect(page.locator('#mobile-search-options [role="option"]').last()).toHaveAttribute('aria-selected', 'true');
  await input.press('ArrowDown');
  await input.press('Enter');
  await expect(page.locator('.details-panel h1')).toHaveText('Café do Centro');
  await page.getByRole('link', { name: 'Fechar detalhes', exact: true }).click();
  await input.fill('abcdef');
  await page.getByRole('button', { name: 'Limpar busca', exact: true }).click();
  await expect(input).toHaveValue('');
  await input.press('Escape');
  await expect(page.getByRole('navigation', { name: 'Navegação mobile' })).toBeVisible();
  await page.route('**/api/bathrooms?q=*', (route) => route.fulfill({ status: 503, json: { detail: 'Indisponível' } }));
  await input.fill('Falha');
  await expect(page.getByRole('alert')).toContainText('Parte das sugestões está indisponível');
  await page.screenshot({ path: '../test-results/mobile-new-search.png' });
});

test('account supports real login intent, theme system and hides moderation on mobile', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.site-header')).toBeHidden();
  await expect(page.locator('.mobile-search-pin')).toHaveAttribute('src', 'assets/brand/khki-pin.png');
  await page.getByRole('button', { name: 'Abrir sua conta', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Buscar banheiro ou endereço' })).not.toBeFocused();
  const account = page.locator('#mobile-account-popover');
  await expect(account.getByRole('link', { name: 'Moderação', exact: true })).toHaveCount(0);
  await account.getByRole('button', { name: 'Aparência', exact: true }).click();
  await account.getByRole('radio', { name: 'Escuro', exact: true }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await account.getByRole('radio', { name: 'Sistema', exact: true }).check();
  expect(await page.evaluate(() => localStorage.getItem('khki-theme'))).toBeNull();
  await account.getByRole('button', { name: 'Fechar conta' }).click();
  await page.getByRole('navigation', { name: 'Navegação mobile' }).getByRole('link', { name: 'Contribuições', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Cadastre-se', exact: true }).click();
  await page.getByLabel('Nome', { exact: true }).fill('Pessoa mobile');
  await page.getByLabel('E-mail', { exact: true }).fill(`mobile-${Date.now()}@khki.test`);
  await page.getByLabel('Senha', { exact: true }).fill('Browser-mobile-password-123');
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await expect(page).toHaveURL(/\/contribuicoes$/);
  await expect(page.getByRole('navigation', { name: 'Navegação mobile' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Navegação mobile' }).getByRole('link', { name: 'Cadastrar', exact: true }).click();
  await expect(page).toHaveURL(/\/cadastrar$/);
  await expect(page.getByRole('navigation', { name: 'Navegação mobile' })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Endereço completo' })).toBeVisible();
});

test('one continuous gesture expands before scrolling and returns through scroll before collapsing', async ({ page }) => {
  const rows = await (await page.request.get('/api/bathrooms')).json();
  await page.route(/\/api\/bathrooms(?:\?.*)?$/, (route) => route.fulfill({ json: Array.from({ length: 20 }, (_, index) => ({ ...rows[index % rows.length], id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}` })) }));
  await page.goto('/');
  await expand(page);
  await expect(page.locator('.result-list')).toHaveCSS('overflow-y', 'hidden');
  await drag(page, '.result-list', -700);
  await expect(page.locator('.map-workspace')).toHaveClass(/mobile-sheet-full/);
  await expect.poll(() => page.locator('.result-list').evaluate((element) => element.scrollTop)).toBeGreaterThan(100);
  await drag(page, '.result-list', 1200);
  await expect(page.locator('.map-workspace')).toHaveClass(/mobile-sheet-peek/);
  expect(await page.locator('.result-list').evaluate((element) => element.scrollTop)).toBe(0);
});

test('expanded details prioritize information and device back closes gallery before details', async ({ page }) => {
  const rows = await (await page.request.get('/api/bathrooms')).json();
  await page.route('**/api/bathrooms/' + rows[0].id, async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...(await response.json()), photoIds: ['mobile-test-one'] } });
  });
  await page.route('**/api/photos/mobile-test-*', (route) => route.fulfill({ contentType: 'image/jpeg', body: readFileSync('../data/demo-regional/images/anexo-01.jpg') }));
  await selectBathroom(page);
  await expect(page.locator('.workspace-content')).toHaveCSS('overflow-y', 'hidden');
  const title = (await page.locator('.details-panel h1').boundingBox())!;
  const photos = (await page.locator('.mobile-detail-photos').boundingBox())!;
  expect(title.y).toBeLessThan(photos.y);
  await expand(page);
  await expect(page.locator('.mobile-search')).toBeHidden();
  await expect(page.locator('.detail-category-fact')).toBeHidden();
  await page.getByRole('button', { name: 'Abrir foto 1', exact: true }).click();
  await expect(page.locator('app-map-photo-viewer')).toBeVisible();
  await page.goBack();
  await expect(page.locator('app-map-photo-viewer')).toHaveCount(0);
  await expect(page.locator('.details-panel h1')).toBeVisible();
  await expect(page.locator('.map-workspace')).toHaveClass(/mobile-sheet-full/);
  await page.goBack();
  await expect(page).toHaveURL('/');
  await expect(page.locator('.mobile-search')).toBeVisible();
});

test('route origin, real mode profiles and active navigation use a clean mobile canvas', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: -23.55, longitude: -46.65 });
  await selectBathroom(page);
  await page.getByRole('link', { name: 'Como chegar', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Navegação mobile' })).toHaveCount(0);
  const origin = page.getByRole('combobox', { name: 'Sua origem', exact: true });
  await origin.click();
  await page.getByRole('option', { name: /Usar minha localização/ }).click();
  await expect(page.locator('.route-summary')).toBeVisible();
  await page.getByRole('radio', { name: 'Moto', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Moto', exact: true })).toBeChecked();
  await expect(page.locator('.route-summary')).toContainText('de moto');
  await page.getByRole('button', { name: 'Iniciar navegação', exact: true }).click();
  await expect(page.locator('.site-header')).toBeHidden();
  await expect(page.locator('.route-panel')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Editar rota', exact: true })).toBeVisible();
  await expect(page.locator('.navigation-simulator')).toHaveCount(0);
  const maneuver = await page.locator('.navigation-directions').boundingBox();
  const summary = await page.locator('.navigation-hud').boundingBox();
  expect(maneuver!.y).toBeLessThan(60);
  expect(summary!.y).toBeGreaterThan(650);
  await page.screenshot({ path: '../test-results/mobile-new-navigation.png' });
  await page.getByRole('button', { name: 'Editar rota', exact: true }).click();
  await expect(origin).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Moto', exact: true })).toBeChecked();
});

test('desktop keeps its original header, sidebar and navigation without mobile elements', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navegação mobile' })).toHaveCount(0);
  await expect(page.locator('app-mobile-search')).toHaveCount(0);
  await expect(page.locator('.mobile-sheet-handle')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Buscar por nome, endereço ou região' })).toBeVisible();
  const panel = await page.locator('.workspace-panel').boundingBox();
  expect(panel!.width).toBeGreaterThanOrEqual(380);
  expect(panel!.height).toBeGreaterThan(800);
});

test('list gestures over a result do not select it and closing details restores the full sheet and scroll', async ({ page }) => {
  await page.goto('/');
  await expand(page, 2);
  await page.locator('.result-list').evaluate((element) => (element.scrollTop = 100));
  const selected = page.locator('.bathroom-card').nth(1);
  const name = await selected.locator('h3').innerText();
  const scroll = await page.locator('.result-list').evaluate((element) => element.scrollTop);
  await selected.click();
  await expect(page.locator('.details-panel h1')).toHaveText(name);
  await page.getByRole('link', { name: 'Fechar detalhes', exact: true }).click();
  await expect(page.locator('.map-workspace')).toHaveClass(/mobile-sheet-full/);
  await expect.poll(() => page.locator('.result-list').evaluate((element) => element.scrollTop)).toBe(scroll);
  await page.locator('.result-list').evaluate((element) => (element.scrollTop = 0));
  await drag(page, '.result-list app-bathroom-card:first-of-type .card-body', 700);
  await expect(page.locator('.map-workspace')).toHaveClass(/mobile-sheet-peek/);
  await expect(page).toHaveURL('/');
});

test('mobile map pan offers search in the visible area and a pin opens the same details sheet', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Buscar nesta área', exact: true })).toHaveCount(0);
  await page.mouse.move(180, 350);
  await page.mouse.down();
  await page.mouse.move(230, 400, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Buscar nesta área', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Buscar nesta área', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Buscar nesta área', exact: true })).toHaveCount(0);
  await page.goto('/');
  const pin = page.getByRole('button', { name: 'Café do Centro', exact: true });
  await pin.click();
  await expect(page.locator('.details-panel h1')).toHaveText('Café do Centro');
  await expect(page.locator('.workspace-content')).toBeVisible();
  await expect(page.locator('.workspace-results')).toBeHidden();
});

test('keyboard-sized viewport keeps origin editable and administration is desktop-only in presentation', async ({ page }) => {
  test.skip(!process.env['KHKI_TEST_ADMIN_PASSWORD'], 'Use o executor isolado com administrador.');
  await selectBathroom(page);
  await page.getByRole('link', { name: 'Como chegar', exact: true }).click();
  const input = page.getByRole('combobox', { name: 'Sua origem', exact: true });
  await input.focus();
  await page.setViewportSize({ width: 393, height: 470 });
  await expect(input).toBeInViewport();
  await input.fill('Rua de teste');
  await expect(page.getByRole('listbox')).toBeVisible();
  await input.press('Escape');
  await page.setViewportSize({ width: 393, height: 852 });
  await page.getByRole('button', { name: 'Recolher painel', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir sua conta', exact: true }).click();
  await page.getByRole('button', { name: 'Entrar ou criar conta', exact: true }).click();
  await page.getByLabel('E-mail', { exact: true }).fill(process.env['KHKI_TEST_ADMIN_EMAIL']!);
  await page.getByLabel('Senha', { exact: true }).fill(process.env['KHKI_TEST_ADMIN_PASSWORD']!);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Moderação no desktop', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Buscar contribuições', exact: true })).toBeHidden();
  await page.setViewportSize({ width: 1440, height: 950 });
  await expect(page.getByRole('textbox', { name: 'Buscar contribuições', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Moderação', exact: true })).toBeVisible();
});

test('all workspace sheets share their maximum top edge and hide controls behind expansion', async ({ page }) => {
  await page.goto('/');
  await expand(page, 2);
  await expect(page.locator('.mobile-search')).toBeHidden();
  const searchTop = (await page.locator('.workspace-panel').boundingBox())!.y;
  const canvas = await page.locator('.maplibregl-canvas').elementHandle();
  await page.locator('.bathroom-card').first().click();
  await expand(page);
  expect(Math.abs((await page.locator('.workspace-panel').boundingBox())!.y - searchTop)).toBeLessThan(1);
  await page.getByRole('link', { name: 'Como chegar', exact: true }).click();
  await expect(page.locator('.workspace-content')).toHaveCSS('overflow-y', 'hidden');
  await drag(page, '.route-panel h1', -700);
  await expect(page.locator('.map-workspace')).toHaveClass(/mobile-sheet-full/);
  expect(Math.abs((await page.locator('.workspace-panel').boundingBox())!.y - searchTop)).toBeLessThan(1);
  await expect(page.locator('.mobile-account-shortcut')).toBeHidden();
  await drag(page, '.route-panel h1', 1200);
  await expect(page.locator('.map-workspace')).toHaveClass(/mobile-sheet-peek/);
  await expect(page.locator('.mobile-account-shortcut')).toBeVisible();
  expect(await canvas!.evaluate((element) => element === document.querySelector('.maplibregl-canvas'))).toBe(true);
});

test('registration shares sheet dragging and locks its nested scroll before maximum height', async ({ page }) => {
  test.skip(!process.env['KHKI_TEST_ADMIN_PASSWORD'], 'Use o executor isolado com administrador.');
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Navegação mobile' }).getByRole('link', { name: 'Cadastrar', exact: true }).click();
  await page.getByLabel('E-mail', { exact: true }).fill(process.env['KHKI_TEST_ADMIN_EMAIL']!);
  await page.getByLabel('Senha', { exact: true }).fill(process.env['KHKI_TEST_ADMIN_PASSWORD']!);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/cadastrar$/);
  await page.getByRole('button', { name: 'Recolher painel', exact: true }).click();
  await expand(page);
  await expect(page.locator('.registration-fields')).toHaveCSS('overflow-y', 'hidden');
  await drag(page, '.registration-heading', -700);
  await expect(page.locator('.map-workspace')).toHaveClass(/mobile-sheet-full/);
  await expect(page.locator('.registration-fields')).toHaveCSS('overflow-y', 'auto');
  await expect(page.locator('.mobile-account-shortcut')).toBeHidden();
  expect(Math.abs((await page.locator('.workspace-panel').boundingBox())!.y - 85.2)).toBeLessThan(1);
});
