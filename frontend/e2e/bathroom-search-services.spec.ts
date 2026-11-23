import { expect, Page, test } from '@playwright/test';
import type { Bathroom } from '../src/app/domain/bathrooms/bathroom.model';

const bathroom = (id: string, name = 'Banheiro ' + id): Bathroom => ({ id, name, address: 'Indaiatuba', category: 'Biblioteca', latitude: -23.1, longitude: -47.2, access: 'FREE', accessDetails: null, hours: null, accessible: null, items: [], rating: null, reviewCount: 0, photoIds: [], demo: false });

async function prepare(page: Page): Promise<void> {
  await page.route('**/config.js', (route) => route.fulfill({ contentType: 'application/javascript', body: 'window.KHKI_CONFIG={geoapifyApiKey:"test",devRouteSimulation:false};' }));
  await page.route('https://maps.geoapify.com/**', (route) => route.fulfill({ json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#173b45' } }] } }));
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401, json: {} }));
  await page.route('https://api.geoapify.com/v1/geocode/autocomplete**', (route) => route.fulfill({ json: { results: [] } }));
}

test('Carrega cada página de resultados uma única vez e preserva o termo da busca', async ({ page }) => {
  await prepare(page);
  const rows = Array.from({ length: 201 }, (_, index) => bathroom(String(index)));
  const requests: { offset: number; query: string }[] = [];
  await page.route(/\/api\/bathrooms(?:\?.*)?$/, (route) => {
    const url = new URL(route.request().url());
    const offset = Number(url.searchParams.get('offset') || 0);
    requests.push({ offset, query: url.searchParams.get('q') || '' });
    return route.fulfill({ json: rows.slice(offset, offset + 200) });
  });
  await page.goto('/');
  await expect(page.locator('.bathroom-card')).toHaveCount(201);
  expect(requests).toEqual([
    { offset: 0, query: '' },
    { offset: 200, query: '' }
  ]);
  await page.getByRole('textbox', { name: 'Buscar por nome, endereço ou região' }).fill('Biblioteca');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect
    .poll(() => requests.slice(-2))
    .toEqual([
      { offset: 0, query: 'Biblioteca' },
      { offset: 200, query: 'Biblioteca' }
    ]);
  await expect(page.locator('.bathroom-card')).toHaveCount(201);
});

test('Interrompe a paginação ao receber páginas repetidas e permite recuperar o erro', async ({ page }) => {
  await prepare(page);
  const rows = Array.from({ length: 200 }, (_, index) => bathroom(String(index)));
  let requests = 0;
  await page.route(/\/api\/bathrooms(?:\?.*)?$/, (route) => {
    requests++;
    return route.fulfill({ json: requests === 1 ? rows : [rows[0]] });
  });
  await page.goto('/');
  await expect(page.locator('.result-list')).toContainText('Não foi possível carregar a busca completa. Tente novamente.');
  await expect(page.getByRole('button', { name: 'Tentar novamente', exact: true })).toBeVisible();
  expect(requests).toBe(2);
});

test('Descarta respostas antigas sem substituir as sugestões atuais no celular', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await prepare(page);
  let releaseOld: () => void = () => {};
  const oldGate = new Promise<void>((resolve) => (releaseOld = resolve));
  let oldFinished: () => void = () => {};
  const oldResponse = new Promise<void>((resolve) => (oldFinished = resolve));
  await page.route(/\/api\/bathrooms(?:\?.*)?$/, async (route) => {
    const query = new URL(route.request().url()).searchParams.get('q') || '';
    if (query === 'antiga') {
      await oldGate;
      await route.fulfill({ json: [bathroom('old', 'Sugestão antiga')] });
      oldFinished();
      return;
    }
    await route.fulfill({ json: query === 'nova' ? [bathroom('new', 'Sugestão nova')] : [] });
  });
  await page.goto('/');
  const input = page.getByRole('combobox', { name: 'Buscar banheiro ou endereço' });
  await input.fill('antiga');
  await page.waitForRequest((request) => new URL(request.url()).searchParams.get('q') === 'antiga');
  await input.fill('nova');
  await expect(page.locator('#mobile-search-options')).toContainText('Sugestão nova');
  releaseOld();
  await oldResponse;
  await expect(page.locator('#mobile-search-options')).not.toContainText('Sugestão antiga');
  await expect(page.locator('#mobile-search-options')).toContainText('Sugestão nova');
  await input.press('ArrowDown');
  await expect(page.locator('#mobile-search-options [role="option"]').first()).toHaveAttribute('aria-selected', 'true');
  await input.press('Escape');
  await expect(page.locator('.mobile-search-options')).toHaveCount(0);
});

test('Mantém as sugestões de endereço quando a busca de sugestões de banheiros falha', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await prepare(page);
  await page.route(/\/api\/bathrooms(?:\?.*)?$/, (route) => {
    const query = new URL(route.request().url()).searchParams.get('q');
    return route.fulfill(query ? { status: 503, json: { message: 'Serviço indisponível.' } } : { json: [] });
  });
  await page.route('https://api.geoapify.com/v1/geocode/autocomplete**', (route) => route.fulfill({ json: { results: [{ formatted: 'Praça Central', address_line2: 'Indaiatuba', lat: -23.1, lon: -47.2 }] } }));
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Buscar banheiro ou endereço' }).fill('praça');
  await expect(page.locator('#mobile-search-options')).toContainText('Praça Central');
  await expect(page.locator('.mobile-search-options [role="alert"]')).toContainText('Parte das sugestões está indisponível');
  await expect(page.locator('.mobile-search-options')).not.toContainText('Buscando sugestões');
});