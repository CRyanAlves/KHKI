import { expect, Page, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test.use({ viewport: { width: 393, height: 852 }, hasTouch: true });
const bathroom = {
  id: 'sheet-actions',
  name: 'Biblioteca Municipal — banheiro próximo à entrada e à recepção principal',
  address: 'Rua das Flores, Indaiatuba',
  category: 'Biblioteca',
  latitude: -23.1,
  longitude: -47.2,
  access: 'FREE',
  accessDetails: 'Entrada principal',
  hours: 'Todos os dias, das 8h às 18h',
  accessible: null,
  items: ['PAPER', 'SINK'],
  rating: 4.5,
  reviewCount: 1,
  photoIds: ['sheet-one', 'sheet-two'],
  demo: false
};
async function prepare(page: Page, direct = true): Promise<void> {
  await page.route('**/config.js', (route) => route.fulfill({ contentType: 'application/javascript', body: 'window.KHKI_CONFIG={geoapifyApiKey:"test",devRouteSimulation:false};' }));
  await page.route('https://maps.geoapify.com/**', (route) => route.fulfill({ json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#173b45' } }] } }));
  await page.route('**/api/auth/csrf', (route) => route.fulfill({ json: {} }));
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401, json: {} }));
  await page.route(/\/api\/bathrooms(?:\?.*)?$/, (route) => route.fulfill({ json: [bathroom] }));
  await page.route('**/api/bathrooms/' + bathroom.id, (route) => route.fulfill({ json: bathroom }));
  await page.route('**/api/bathrooms/' + bathroom.id + '/reviews', (route) => route.fulfill({ json: [{ id: 'review-one', author: 'Pessoa Teste', cleanliness: 5, structure: 4, comment: 'Local organizado.', createdAt: '2026-11-01T12:00:00Z' }] }));
  await page.route('**/api/photos/sheet-*', (route) => route.fulfill({ contentType: 'image/jpeg', body: readFileSync('../data/demo-regional/images/anexo-01.jpg') }));
  await page.goto(direct ? '/banheiros/' + bathroom.id : '/');
  if (direct) await expect(page.locator('.details-panel h1')).toHaveText(bathroom.name);
}
async function peek(page: Page): Promise<void> {
  await page.locator('.mobile-sheet-handle').press('ArrowDown');
  await expect(page.locator('.details-panel')).toHaveClass(/details-compact/);
  await expect
    .poll(async () => {
      const sheet = (await page.locator('.workspace-panel').boundingBox())!;
      const actions = (await page.locator('.detail-actions').boundingBox())!;
      return actions.y + actions.height <= sheet.y + sheet.height - 12;
    })
    .toBe(true);
}
async function drag(page: Page, selector: string, delta: number): Promise<void> {
  await page.locator(selector).evaluate((element, delta) => {
    const rect = element.getBoundingClientRect();
    const point = { identifier: 1, target: element, clientX: rect.x + rect.width / 2, clientY: rect.y + 8 };
    element.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [new Touch(point)] }));
    for (let index = 1; index <= 8; index++) element.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: [new Touch({ ...point, clientY: point.clientY + (delta * index) / 8 })] }));
    element.dispatchEvent(new TouchEvent('touchend', { bubbles: true, changedTouches: [new Touch({ ...point, clientY: point.clientY + delta })] }));
  }, delta);
}

test('compact actions remain inside measured sheet and secondary content is not accessible', async ({ page }) => {
  await prepare(page);
  const canvas = await page.locator('.maplibregl-canvas').elementHandle();
  for (const theme of ['dark', 'light']) {
    await page.evaluate((value) => (document.documentElement.dataset['theme'] = value), theme);
    await peek(page);
    await expect(page.getByRole('link', { name: 'Como chegar', exact: true })).toBeInViewport();
    await expect(page.getByRole('link', { name: 'Avaliar', exact: true })).toBeInViewport();
    await expect(page.getByRole('link', { name: 'Como chegar', exact: true })).toHaveCount(1);
    await expect(page.getByRole('heading', { name: bathroom.name, exact: true })).toBeVisible();
    await expect(page.locator('.details-panel h1')).toHaveCSS('text-overflow', 'ellipsis');
    await expect(page.locator('.detail-secondary')).toHaveAttribute('inert', '');
    await expect(page.getByRole('tab')).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Navegação mobile' })).toHaveCount(0);
    const title = (await page.locator('.details-panel h1').boundingBox())!;
    const close = (await page.getByRole('link', { name: 'Fechar detalhes' }).boundingBox())!;
    expect(title.x + title.width).toBeLessThan(close.x);
    await expect
      .poll(async () => {
        const locate = (await page.getByRole('button', { name: 'Usar minha localização', exact: true }).boundingBox())!;
        const sheet = (await page.locator('.workspace-panel').boundingBox())!;
        return locate.y + locate.height <= sheet.y;
      })
      .toBe(true);
    await expect(page.locator('.map-marker.is-selected')).toBeVisible();
    await page.screenshot({ path: `../test-results/details-compact-${theme}.png` });
  }
  expect(await canvas!.evaluate((element) => element === document.querySelector('.maplibregl-canvas'))).toBe(true);
});

test('small screen, enlarged fonts, safe bottom padding and reduced motion keep buttons reachable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await prepare(page);
  await page.addStyleTag({ content: 'html { font-size: 22px; } html.mobile-ui .detail-scene .details-panel { padding-bottom: calc(var(--space-4) + 34px); }' });
  await peek(page);
  expect(await page.locator('.detail-secondary').evaluate((element) => Number.parseFloat(getComputedStyle(element).transitionDuration))).toBeLessThanOrEqual(0.001);
  await expect(page.getByRole('link', { name: 'Como chegar', exact: true })).toBeInViewport();
  await expect(page.getByRole('link', { name: 'Avaliar', exact: true })).toBeInViewport();
  const sheet = (await page.locator('.workspace-panel').boundingBox())!;
  const actions = (await page.locator('.detail-actions').boundingBox())!;
  expect(sheet.y + sheet.height - actions.y - actions.height).toBeGreaterThanOrEqual(34);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.screenshot({ path: '../test-results/details-compact-large-font.png' });
});

test('dragging expands, scroll unlocks at full height and scrolling down restores compact actions', async ({ page }) => {
  await prepare(page);
  await peek(page);
  await expect(page.locator('.workspace-content')).toHaveCSS('overflow-y', 'hidden');
  await drag(page, '.mobile-sheet-handle', -1000);
  await expect(page.locator('.map-workspace')).toHaveClass(/mobile-sheet-full/);
  await expect(page.locator('.workspace-content')).toHaveCSS('overflow-y', 'auto');
  await expect(page.getByRole('tab', { name: 'Visão geral' })).toBeVisible();
  await expect(page.locator('.mobile-detail-photos')).toBeVisible();
  await page.screenshot({ path: '../test-results/details-expanded-actions.png' });
  await page.locator('.workspace-content').evaluate((element) => (element.scrollTop = 100));
  await drag(page, '.details-panel .detail-facts', 1000);
  await expect(page.locator('.map-workspace')).toHaveClass(/mobile-sheet-peek/);
  await peek(page);
  expect(await page.locator('.workspace-content').evaluate((element) => element.scrollTop)).toBe(0);
});

test('compact route action opens the existing route flow on the same map', async ({ page }) => {
  await prepare(page);
  const canvas = await page.locator('.maplibregl-canvas').elementHandle();
  await peek(page);
  await page.getByRole('link', { name: 'Como chegar', exact: true }).tap();
  await expect(page).toHaveURL(/\/sheet-actions\/rota$/);
  await expect(page.getByRole('combobox', { name: 'Sua origem' })).toBeVisible();
  expect(await canvas!.evaluate((element) => element === document.querySelector('.maplibregl-canvas'))).toBe(true);
});

test('compact review action preserves contextual login and resumes after authentication', async ({ page }) => {
  await prepare(page);
  await peek(page);
  await page.route('**/api/auth/login', (route) => route.fulfill({ json: { id: 'user', name: 'Pessoa Teste', role: 'USER' } }));
  await page.getByRole('link', { name: 'Avaliar', exact: true }).tap();
  await expect(page.locator('.login-backdrop')).toBeVisible();
  await page.getByLabel('E-mail', { exact: true }).fill('pessoa@example.com');
  await page.getByLabel('Senha', { exact: true }).fill('senha-para-teste');
  await page.locator('.login-form').getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/sheet-actions\/avaliar$/);
  await expect(page.getByRole('heading', { name: 'Avaliar banheiro.' })).toBeVisible();
});

test('closing details restores results and the previous sheet position', async ({ page }) => {
  await prepare(page, false);
  await page.locator('.mobile-sheet-handle').press('ArrowUp');
  const prior = await page.locator('.map-workspace').getAttribute('class');
  await page.locator('.bathroom-card').first().click();
  await expect(page.locator('.details-panel h1')).toBeVisible();
  await peek(page);
  await page.getByRole('link', { name: 'Fechar detalhes' }).tap();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('.map-workspace')).toHaveAttribute('class', prior!);
  await expect(page.getByRole('navigation', { name: 'Navegação mobile' })).toBeVisible();
});

test('desktop retains the original gallery, metadata and actions', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 950 });
  await prepare(page);
  await expect(page.locator('.details-panel')).not.toHaveClass(/details-compact/);
  await expect(page.locator('.gallery')).toBeVisible();
  await expect(page.locator('.details-rating-row')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Como chegar', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Avaliar', exact: true })).toBeVisible();
  await expect(page.locator('.details-primary')).toHaveCSS('display', 'contents');
});

test('actions stay inside the panel throughout frame-by-frame dragging with enlarged text', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await prepare(page);
  await page.addStyleTag({ content: 'html { font-size: 22px; }' });
  await peek(page);
  for (const delta of [-500, 500]) {
    const measurements = await page.locator('.mobile-sheet-handle').evaluate(async (handle, delta) => {
      const rect = handle.getBoundingClientRect();
      const point = { identifier: 1, target: handle, clientX: rect.x + rect.width / 2, clientY: rect.y + 8 };
      const result: number[] = [];
      handle.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [new Touch(point)] }));
      for (let index = 1; index <= 18; index++) {
        handle.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: [new Touch({ ...point, clientY: point.clientY + (delta * index) / 18 })] }));
        await new Promise(requestAnimationFrame);
        const sheet = document.querySelector('.workspace-panel')!.getBoundingClientRect();
        const actions = document.querySelector('.detail-actions')!.getBoundingClientRect();
        result.push(sheet.bottom - actions.bottom);
      }
      handle.dispatchEvent(new TouchEvent('touchend', { bubbles: true, changedTouches: [new Touch({ ...point, clientY: point.clientY + delta })] }));
      return result;
    }, delta);
    expect(Math.min(...measurements)).toBeGreaterThanOrEqual(0);
  }
});
