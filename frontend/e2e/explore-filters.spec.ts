import { expect, Page, test } from '@playwright/test';
import type { Bathroom, BathroomDetails } from '../src/app/core/models';

const details = (audience: BathroomDetails['audience'], charge: BathroomDetails['charge'], stepFreeAccess: boolean | null, adaptedCabin: boolean | null, grabBars: boolean | null): BathroomDetails => ({ audience, charge, stepFreeAccess, adaptedCabin, grabBars, elevator: null, feeAmount: null, bathroomTypes: [], lastVisited: null });
const bathroom = (id: string, value: BathroomDetails, longitude: number, accessible: boolean | null, items: string[], category = 'Biblioteca'): Bathroom => ({
  id,
  name: 'Local ' + id,
  address: 'Indaiatuba',
  complement: '',
  category,
  latitude: -23.1,
  longitude,
  access: 'FREE',
  accessDetails: null,
  hours: null,
  accessible,
  items,
  rating: 4,
  reviewCount: 1,
  photoIds: [],
  demo: false,
  details: value
});
const rows = [
  bathroom('a', details('PUBLIC', 'NO', true, true, false), -47.2, true, ['PAPER', 'SINK', 'CHANGING_TABLE']),
  bathroom('b', details('PUBLIC', 'YES', false, true, true), -47.198, false, ['SOAP', 'SINK'], 'Shopping'),
  bathroom('c', details('CUSTOMERS', 'NO', true, false, true), -47.18, true, ['PAPER', 'SINK'], 'Cafeteria'),
  bathroom('d', details('UNKNOWN', 'UNKNOWN', null, null, null), -47.15, null, [], 'Parque'),
  bathroom('e', details('AUTHORIZATION', 'NO', false, false, false), -47.19, false, ['BIN']),
  bathroom('f', details('PUBLIC', 'UNKNOWN', true, true, true), -47.199, true, ['SOAP'])
];
async function setup(page: Page, data = rows): Promise<void> {
  await page.route('**/config.js', (route) => route.fulfill({ contentType: 'application/javascript', body: 'window.KHKI_CONFIG={geoapifyApiKey:"test",devRouteSimulation:false};' }));
  await page.route('https://maps.geoapify.com/**', (route) => route.fulfill({ json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#173b45' } }] } }));
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401, json: {} }));
  await page.route(/\/api\/bathrooms(?:\?.*)?$/, (route) => {
    const url = new URL(route.request().url());
    const found = data.filter((row) => row.name.toLowerCase().includes((url.searchParams.get('q') || '').toLowerCase()));
    const offset = Number(url.searchParams.get('offset') || 0);
    return route.fulfill({ json: found.slice(offset, offset + 200) });
  });
  await page.goto('/');
  await expect(page.locator('.bathroom-card')).toHaveCount(data.length);
}
const panel = (page: Page) => page.locator('#explore-filters-panel');
async function open(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^Filtros(?: · \d+)?$/ }).click();
  await expect(panel(page)).toBeVisible();
}
async function apply(page: Page, count: number): Promise<void> {
  await panel(page)
    .getByRole('button', { name: `Mostrar ${count} ${count === 1 ? 'banheiro' : 'banheiros'}`, exact: true })
    .click();
  await expect(panel(page)).toHaveCount(0);
  await expect(page.locator('.bathroom-card')).toHaveCount(count);
}
async function markerIds(page: Page): Promise<string[]> {
  return page.locator('.map-marker, .map-cluster').evaluateAll((elements) => elements.flatMap((element) => ((element as HTMLElement).dataset['bathroomIds'] || (element as HTMLElement).dataset['bathroomId'] || '').split(',').filter(Boolean)).sort());
}

test('access and charging are independent; draft cancel, clear and apply preserve context', async ({ page }) => {
  await setup(page);
  const map = await page.locator('.maplibregl-canvas').elementHandle();
  await page.getByRole('combobox', { name: 'Ordenação' }).selectOption('rating');
  let calls = 0;
  page.on('request', (request) => {
    if (/\/api\/bathrooms\?/.test(request.url())) calls++;
  });
  await open(page);
  await panel(page).getByRole('radio', { name: 'Livre para todos', exact: true }).check();
  await expect(panel(page).getByRole('button', { name: 'Mostrar 3 banheiros' })).toBeEnabled();
  await panel(page).getByRole('radio', { name: 'Gratuito', exact: true }).check();
  await expect(page.locator('.bathroom-card')).toHaveCount(6);
  await panel(page).getByRole('button', { name: 'Fechar filtros sem aplicar' }).click();
  await open(page);
  await expect(panel(page).getByRole('radio', { name: 'Sem preferência', exact: true }).first()).toBeChecked();
  await panel(page).getByRole('radio', { name: 'Livre para todos', exact: true }).check();
  await panel(page).getByRole('radio', { name: 'Pago', exact: true }).check();
  await apply(page, 1);
  await expect(page.locator('.bathroom-card')).toContainText('Local b');
  await expect(page.getByRole('button', { name: 'Filtros · 2', exact: true })).toBeVisible();
  await expect.poll(() => markerIds(page)).toEqual(['b']);
  await page.getByRole('button', { name: 'Remover filtro: Pago', exact: true }).click();
  await expect(page.locator('.bathroom-card')).toHaveCount(3);
  await open(page);
  await panel(page).getByRole('button', { name: 'Limpar', exact: true }).click();
  await expect(panel(page).getByRole('button', { name: 'Mostrar 6 banheiros' })).toBeEnabled();
  await expect(page.locator('.bathroom-card')).toHaveCount(3);
  await apply(page, 6);
  await expect(page.getByRole('combobox', { name: 'Ordenação' })).toHaveValue('rating');
  expect(await map!.evaluate((element) => element === document.querySelector('.maplibregl-canvas'))).toBe(true);
  expect(calls).toBe(0);
});

test('confirmed resources intersect, categories union, and shortcuts never double-count', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'Acessível', exact: true }).click();
  await expect(page.locator('.bathroom-card')).toHaveCount(3);
  await open(page);
  await expect(panel(page).getByRole('checkbox', { name: 'Acessível — informação geral' })).toBeChecked();
  await panel(page).getByRole('checkbox', { name: 'Acesso sem degraus', exact: true }).check();
  await panel(page).getByRole('checkbox', { name: 'Barras de apoio', exact: true }).check();
  await apply(page, 2);
  await expect(page.getByRole('button', { name: 'Filtros · 3', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
  await page.getByRole('button', { name: 'Fraldário', exact: true }).click();
  await open(page);
  await panel(page).getByText('Categoria e estrutura', { exact: true }).click();
  await expect(panel(page).getByRole('checkbox', { name: 'Fraldário', exact: true })).toBeChecked();
  await panel(page).getByRole('checkbox', { name: 'Papel higiênico', exact: true }).check();
  await panel(page).getByRole('checkbox', { name: 'Biblioteca', exact: true }).check();
  await panel(page).getByRole('checkbox', { name: 'Shopping', exact: true }).check();
  await apply(page, 1);
  await expect(page.getByRole('button', { name: 'Filtros · 4', exact: true })).toBeVisible();
  await page.locator('.applied-filter-tags').getByRole('button', { name: 'Remover filtro: Fraldário' }).click();
  await expect(page.getByRole('button', { name: 'Fraldário', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
  await open(page);
  await panel(page).getByRole('radio', { name: 'Gratuito', exact: true }).check();
  await apply(page, 3);
  await expect(page.locator('.bathroom-card').filter({ hasText: 'Local d' })).toHaveCount(0);
  await expect(page.locator('.bathroom-card').filter({ hasText: 'Local f' })).toHaveCount(0);
});

test('distance is disabled without reference and does not ask GPS permission', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).gpsCalls = 0;
    navigator.geolocation.getCurrentPosition = () => {
      (window as any).gpsCalls++;
    };
  });
  await setup(page);
  await open(page);
  await expect(panel(page).getByText('Defina uma localização para filtrar por distância.')).toBeVisible();
  await expect(panel(page).getByRole('radio', { name: '500 m', exact: true })).toBeDisabled();
  await expect(panel(page).getByRole('radio', { name: 'Sem limite', exact: true })).toBeChecked();
  expect(await page.evaluate(() => (window as any).gpsCalls)).toBe(0);
});

test('distance uses a valid known location in straight line', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: -23.1, longitude: -47.2 });
  await setup(page);
  await open(page);
  await expect(panel(page).getByText('A partir de Minha localização')).toBeVisible();
  await panel(page).getByRole('radio', { name: '500 m', exact: true }).check();
  await apply(page, 3);
  await expect.poll(() => markerIds(page)).toEqual(['a', 'b', 'f']);
});

test('mobile filters overlay preserves sheet, blocks map and has reachable scrolling and footer', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await setup(page);
  const sheet = await page.locator('.map-workspace').getAttribute('class');
  const canvas = await page.locator('.maplibregl-canvas').elementHandle();
  await open(page);
  await expect(panel(page)).toHaveAttribute('role', 'dialog');
  await expect(panel(page)).toHaveAttribute('aria-modal', 'true');
  await expect(panel(page).getByRole('button', { name: 'Fechar filtros sem aplicar' })).toBeFocused();
  await panel(page).getByRole('radio', { name: 'Pago', exact: true }).check();
  await page.keyboard.press('Escape');
  await expect(page.locator('.map-workspace')).toHaveAttribute('class', sheet!);
  await expect(page.locator('.bathroom-card')).toHaveCount(6);
  await open(page);
  await expect(panel(page).getByRole('radio', { name: 'Sem preferência', exact: true }).last()).toBeChecked();
  for (const theme of ['dark', 'light']) {
    await page.evaluate((value) => (document.documentElement.dataset['theme'] = value), theme);
    await expect(panel(page).getByRole('button', { name: 'Mostrar 6 banheiros' })).toBeInViewport();
    await panel(page).getByText('Categoria e estrutura', { exact: true }).click();
    await panel(page).getByRole('checkbox', { name: 'Fraldário', exact: true }).scrollIntoViewIfNeeded();
    await expect(panel(page).getByRole('checkbox', { name: 'Fraldário', exact: true })).toBeInViewport();
    await page.screenshot({ path: `../test-results/filters-mobile-${theme}.png` });
    await panel(page).getByText('Categoria e estrutura', { exact: true }).click();
  }
  await panel(page).getByRole('checkbox', { name: 'Acessível — informação geral' }).check();
  await apply(page, 3);
  await expect(page.locator('.map-workspace')).toHaveAttribute('class', sheet!);
  expect(await canvas!.evaluate((element) => element === document.querySelector('.maplibregl-canvas'))).toBe(true);
  await page.setViewportSize({ width: 320, height: 600 });
  await page.addStyleTag({ content: 'html { font-size: 21px; }' });
  await open(page);
  await expect(panel(page).getByRole('button', { name: 'Mostrar 3 banheiros' })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

test('full paginated search supports matches beyond the first 200 records', async ({ page }) => {
  const data = Array.from({ length: 201 }, (_, index) => bathroom('page-' + index, details('PUBLIC', 'NO', null, null, null), -47.2, null, index === 200 ? ['PAPER'] : []));
  await setup(page, data);
  await open(page);
  await panel(page).getByText('Categoria e estrutura', { exact: true }).click();
  await panel(page).getByRole('checkbox', { name: 'Papel higiênico', exact: true }).check();
  await apply(page, 1);
  await expect(page.locator('.bathroom-card')).toContainText('Local page-200');
});

test('errors never look like zero results and active filters can be removed from empty list', async ({ page }) => {
  await setup(page);
  await open(page);
  await panel(page).getByRole('radio', { name: 'Apenas clientes', exact: true }).check();
  await panel(page).getByRole('radio', { name: 'Pago', exact: true }).check();
  await apply(page, 0);
  await expect(page.getByText('Ainda não encontramos um lugar aqui')).toBeVisible();
  await page.locator('.empty-filter-actions').getByRole('button', { name: 'Remover filtro: Pago' }).click();
  await expect(page.locator('.bathroom-card')).toHaveCount(1);
  await page.route(/\/api\/bathrooms(?:\?.*)?$/, (route) => route.fulfill({ status: 503, json: {} }));
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.getByText('Não conseguimos carregar os locais')).toBeVisible();
  await expect(page.locator('.results-heading strong').last()).toHaveText('Busca indisponível');
  await open(page);
  await expect(panel(page).getByRole('button', { name: 'Busca indisponível' })).toBeDisabled();
  await expect(panel(page).getByText('Não foi possível carregar a busca completa.')).toBeVisible();
});

test('a failed later page never exposes a partial count and retry loads the full search', async ({ page }) => {
  await setup(page);
  const data = Array.from({ length: 201 }, (_, index) => bathroom('complete-' + index, details('PUBLIC', 'NO', null, null, null), -47.2, null, index === 200 ? ['PAPER'] : []));
  let fail = true;
  await page.route(/\/api\/bathrooms(?:\?.*)?$/, (route) => {
    const offset = Number(new URL(route.request().url()).searchParams.get('offset') || 0);
    if (offset && fail) return route.fulfill({ status: 503, json: {} });
    return route.fulfill({ json: data.slice(offset, offset + 200) });
  });
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.getByText('Não conseguimos carregar os locais')).toBeVisible();
  await expect(page.locator('.results-heading strong').last()).toHaveText('Busca indisponível');
  await open(page);
  await expect(panel(page).getByRole('button', { name: 'Busca indisponível' })).toBeDisabled();
  await expect(panel(page).getByRole('button', { name: /Mostrar 200/ })).toHaveCount(0);
  fail = false;
  await panel(page).getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(panel(page).getByRole('button', { name: 'Mostrar 201 banheiros' })).toBeEnabled();
  await apply(page, 201);
});
