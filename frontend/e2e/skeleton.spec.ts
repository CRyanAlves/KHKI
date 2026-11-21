import { BrowserContext, expect, Page, test } from '@playwright/test';

let administratorCookies: Awaited<ReturnType<BrowserContext['cookies']>> = [];

async function hold(page: Page, matches: (url: URL) => boolean): Promise<() => void> {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/**', async (route) => {
    if (matches(new URL(route.request().url()))) await gate;
    await route.fallback();
  });
  return release;
}
async function login(page: Page): Promise<void> {
  if (administratorCookies.length) {
    await page.context().addCookies(administratorCookies);
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Moderação', exact: true })).toBeVisible();
    return;
  }
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('E-mail', { exact: true }).fill(process.env['KHKI_TEST_ADMIN_EMAIL']!);
  await dialog.getByLabel('Senha', { exact: true }).fill(process.env['KHKI_TEST_ADMIN_PASSWORD']!);
  await dialog.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Moderação', exact: true })).toBeVisible();
  administratorCookies = await page.context().cookies();
}
test.beforeEach(async ({ page }) => {
  test.skip(!process.env['KHKI_TEST_ADMIN_PASSWORD'], 'Execute npm test para usar os serviços isolados.');
  await page.route('**/config.js', (route) => route.fulfill({ contentType: 'application/javascript', body: "window.KHKI_CONFIG = { geoapifyApiKey: '' };" }));
});

test('search skeleton follows themes and reduced motion and gives way to data or an error', async ({ page }) => {
  const release = await hold(page, (url) => url.pathname === '/api/bathrooms');
  await page.goto('/');
  const skeleton = page.locator('app-explore app-skeleton');
  await expect(skeleton).toBeVisible();
  await expect(skeleton).toHaveAttribute('aria-busy', 'true');
  await expect(skeleton.locator('.skeleton-layout')).toHaveAttribute('aria-hidden', 'true');
  const shape = skeleton.locator('.skeleton-shape').first();
  const light = await shape.evaluate((element) => getComputedStyle(element).backgroundColor);
  await expect.poll(() => shape.evaluate((element) => getComputedStyle(element, '::after').animationName)).toBe('skeleton-shimmer');
  await page.getByRole('button', { name: 'Ativar modo escuro', exact: true }).click();
  await expect.poll(() => shape.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(light);
  await page.screenshot({ path: '../test-results/skeleton-dark-search.png', fullPage: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => shape.evaluate((element) => getComputedStyle(element, '::after').animationName)).toBe('none');
  release();
  await expect(skeleton).toHaveCount(0);
  await expect(page.locator('.bathroom-card').first()).toBeVisible();
  await page.route('**/api/bathrooms?*', (route) => route.fulfill({ status: 503, contentType: 'application/problem+json', body: JSON.stringify({ detail: 'Serviço temporariamente indisponível.' }) }));
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.getByText('Não conseguimos carregar os locais')).toBeVisible();
  await expect(skeleton).toHaveCount(0);
});

test('details, route and contribution forms keep the map while loading', async ({ page }) => {
  await login(page);
  const bathrooms = await (await page.request.get('/api/bathrooms')).json();
  const id = bathrooms[0].id;
  let release = await hold(page, (url) => url.pathname === '/api/bathrooms/' + id + '/reviews');
  await page.locator('.bathroom-card[href="/banheiros/' + id + '"]').click();
  await expect(page.locator('app-details app-skeleton')).toBeVisible();
  const map = await page.locator('app-map').elementHandle();
  release();
  await expect(page.locator('app-details .title-row')).toBeVisible();
  await page.route('**/api/bathrooms/' + id, (route) => route.fallback());
  for (const [path, selector, label] of [
    ['rota', 'app-route', 'Carregando destino…'],
    ['avaliar', 'app-review', 'Carregando formulário…'],
    ['fotos', 'app-photos', 'Carregando formulário…']
  ]) {
    release = await hold(page, (url) => url.pathname === '/api/bathrooms/' + id);
    await page.evaluate(
      (url) => {
        history.pushState(null, '', url);
        window.dispatchEvent(new PopStateEvent('popstate'));
      },
      '/banheiros/' + id + '/' + path
    );
    const skeleton = page.locator(selector + ' app-skeleton');
    await expect(skeleton).toContainText(label);
    expect(await map!.evaluate((element) => element === document.querySelector('app-map'))).toBe(true);
    release();
    await expect(skeleton).toHaveCount(0);
    await expect(page.locator(selector + (path === 'rota' ? ' app-origin-picker' : ' form'))).toBeVisible();
  }
});

test('registration and contributions show their own skeletons without discarding inputs', async ({ page }) => {
  await login(page);
  let release = await hold(page, (url) => url.pathname === '/api/bathrooms');
  await page.getByRole('link', { name: 'Cadastrar banheiro', exact: true }).click();
  await expect(page.locator('app-register app-skeleton')).toContainText('Carregando banheiros cadastrados…');
  await page.getByRole('textbox', { name: 'Nome do local' }).fill('Rascunho preservado');
  release();
  await expect(page.locator('app-register app-skeleton')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Nome do local' })).toHaveValue('Rascunho preservado');
  page.on('dialog', (dialog) => dialog.accept());
  release = await hold(page, (url) => url.pathname === '/api/me/contributions');
  await page.getByRole('link', { name: 'Minhas contribuições', exact: true }).click();
  await expect(page.locator('app-contributions app-skeleton')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '../test-results/skeleton-mobile-contributions.png', fullPage: true });
  release();
  await expect(page.locator('app-contributions app-skeleton')).toHaveCount(0);
});

test('moderation categories, content and history replace pending content with skeletons', async ({ page }) => {
  await login(page);
  let release = await hold(page, (url) => url.pathname === '/api/admin/queue/details');
  await page.getByRole('link', { name: 'Moderação', exact: true }).click();
  await expect(page.locator('.queue-table app-skeleton')).toBeVisible();
  release();
  await expect(page.locator('.queue-table app-skeleton')).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Status da contribuição', exact: true }).selectOption('APPROVED');
  await expect(page.locator('.queue-table app-skeleton')).toHaveCount(0);
  for (const title of ['Avaliações', 'Fotos', 'Denúncias', 'Banheiros']) {
    await page
      .getByRole('navigation', { name: 'Categorias de moderação' })
      .getByRole('button', { name: new RegExp('^' + title) })
      .click();
    await expect(page.locator('.queue-table')).toBeVisible();
  }
  const releaseHistory = await hold(page, (url) => /\/api\/admin\/content\//.test(url.pathname) && url.pathname.endsWith('/history'));
  release = await hold(page, (url) => /\/api\/admin\/content\//.test(url.pathname) && !url.pathname.endsWith('/history'));
  await page
    .getByRole('button', { name: /^Analisar / })
    .first()
    .click();
  await expect(page.locator('.review-content app-skeleton')).toBeVisible();
  release();
  await expect(page.locator('.review-content > app-skeleton')).toHaveCount(0);
  await page.locator('.review-history summary').click();
  await expect(page.locator('.review-history app-skeleton')).toBeVisible();
  releaseHistory();
  await expect(page.locator('.review-history app-skeleton')).toHaveCount(0);
});

test('protected navigation shows a skeleton while restoring the session and then releases the page', async ({ page }) => {
  await login(page);
  const release = await hold(page, (url) => url.pathname === '/api/auth/me');
  await page.goto('/cadastrar');
  await expect(page.locator('.navigation-loading app-skeleton')).toBeVisible();
  await expect(page.locator('#main-content')).toHaveAttribute('aria-busy', 'true');
  release();
  await expect(page.locator('.navigation-loading')).toHaveCount(0);
  await expect(page.locator('#main-content')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByRole('textbox', { name: 'Nome do local' })).toBeVisible();
});

test('map and route calculation skeletons release the same canvas when ready', async ({ page }) => {
  test.skip(!process.env['KHKI_MAPS_SIMULATION_URL'], 'Execute npm test para usar o mapa simulado.');
  const simulation = process.env['KHKI_MAPS_SIMULATION_URL'];
  await page.route('**/config.js', (route) => route.fulfill({ contentType: 'application/javascript', body: `window.KHKI_CONFIG = ${JSON.stringify({ geoapifyApiKey: 'simulation-key', geoapifyApiBaseUrl: simulation + '/v1', geoapifyMapsBaseUrl: simulation + '/v1' })};` }));
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/styles/**/style.json*', async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto('/');
  const skeleton = page.locator('.map-loading app-skeleton');
  await expect(skeleton).toBeVisible();
  const canvas = await page.locator('.maplibregl-canvas').elementHandle();
  release();
  await expect(skeleton).toHaveCount(0);
  expect(await canvas!.evaluate((element) => element === document.querySelector('.maplibregl-canvas'))).toBe(true);
  let releaseRoute!: () => void;
  const routeGate = new Promise<void>((resolve) => {
    releaseRoute = resolve;
  });
  await page.route('**/routing?*', async (route) => {
    await routeGate;
    await route.continue();
  });
  await page.locator('.bathroom-card').first().click();
  await page.getByRole('link', { name: 'Como chegar', exact: true }).click();
  await page.getByRole('combobox', { name: 'Sua origem', exact: true }).fill('Rua Augusta, São Paulo');
  await page.getByRole('combobox', { name: 'Sua origem', exact: true }).press('Enter');
  await expect(page.locator('app-route app-skeleton')).toContainText('Atualizando rota…');
  releaseRoute();
  await expect(page.locator('app-route app-skeleton')).toHaveCount(0);
  await expect(page.locator('.route-summary')).toBeVisible();
  expect(await canvas!.evaluate((element) => element === document.querySelector('.maplibregl-canvas'))).toBe(true);
});
