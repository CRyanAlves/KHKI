import { expect, test } from '@playwright/test';
const simulation = process.env['KHKI_MAPS_SIMULATION_URL'];
test.beforeEach(async ({ page }) => {
  test.skip(!simulation, 'Execute npm test para iniciar os serviços isolados.');
  await page.route('**/config.js', (route) => route.fulfill({ contentType: 'application/javascript', body: `window.KHKI_CONFIG = ${JSON.stringify({ geoapifyApiKey: 'simulation-key', geoapifyApiBaseUrl: simulation + '/v1', geoapifyMapsBaseUrl: simulation + '/v1' })};` }));
});
test('desktop keeps results mounted and restores independent scroll and focus when closing details', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 650 });
  await page.goto('/');
  await expect(page.locator('.bathroom-card')).toHaveCount(3);
  const list = page.locator('.result-list');
  const originalList = await list.elementHandle();
  const canvas = await page.locator('.maplibregl-canvas').elementHandle();
  await list.evaluate((el) => {
    el.scrollTop = 100;
  });
  const scroll = await list.evaluate((el) => el.scrollTop);
  const listWidth = (await page.locator('.workspace-panel').boundingBox())!.width;
  await page.getByRole('button', { name: 'Café do Centro', exact: true }).click();
  await expect(page.locator('.details-panel h1')).toHaveText('Café do Centro');
  await expect(page.locator('.workspace-results')).toBeVisible();
  await expect.poll(async () => (await page.locator('.workspace-content').boundingBox())!.x).toBeCloseTo(listWidth, 0);
  const content = await page.locator('.workspace-content').boundingBox();
  expect(content!.x).toBeCloseTo(listWidth, 0);
  expect(content!.width).toBeGreaterThanOrEqual(360);
  expect(await originalList!.evaluate((el) => el === document.querySelector('.result-list'))).toBe(true);
  expect(await list.evaluate((el) => el.scrollTop)).toBe(scroll);
  await page.locator('.workspace-content').evaluate((el) => {
    el.scrollTop = 180;
  });
  expect(await list.evaluate((el) => el.scrollTop)).toBe(scroll);
  await page.getByRole('link', { name: 'Fechar detalhes', exact: true }).click();
  await expect(page.locator('.details-panel')).toHaveCount(0);
  await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBe(scroll);
  await expect(page.locator('.bathroom-card.is-selected')).toBeFocused();
  expect(await canvas!.evaluate((el) => el === document.querySelector('.maplibregl-canvas'))).toBe(true);
  expect(await page.evaluate(() => scrollY)).toBe(0);
});
test('rapid result selection ignores stale responses and resets only detail scroll', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 700 });
  const rows = await (await page.request.get('/api/bathrooms')).json();
  const first = rows[0],
    second = rows[1];
  let waiting = false;
  await page.route('**/api/bathrooms/' + first.id, async (route) => {
    waiting = true;
    await new Promise((resolve) => setTimeout(resolve, 900));
    await route.continue();
  });
  await page.goto('/');
  await expect(page.locator('.bathroom-card')).toHaveCount(3);
  await page.locator('.workspace-results .bathroom-card').filter({ hasText: first.name }).click();
  await expect.poll(() => waiting).toBe(true);
  await page.locator('.workspace-results .bathroom-card').filter({ hasText: second.name }).click();
  await expect(page.locator('.details-panel h1')).toHaveText(second.name);
  await page.waitForTimeout(1000);
  await expect(page.locator('.details-panel h1')).toHaveText(second.name);
  expect(await page.locator('.workspace-content').evaluate((el) => el.scrollTop)).toBe(0);
  await expect(page.locator('.bathroom-card.is-selected')).toContainText(second.name);
  await expect(page.locator('.map-marker.is-selected')).toHaveAttribute('aria-label', second.name);
});
test('photo selection preserves the cover and opens photos over the map with keyboard navigation and reports', async ({ page }) => {
  const rows = await (await page.request.get('/api/bathrooms')).json();
  const row = rows[1];
  await page.goto('/');
  const image = await page.screenshot();
  await page.route('**/api/bathrooms/' + row.id, async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...(await response.json()), photoIds: ['test-gallery-one', 'test-gallery-two'], complement: 'Bloco B · 2º andar', accessible: null } });
  });
  await page.route('**/api/photos/test-gallery-*', (route) => route.fulfill({ contentType: 'image/png', body: image }));
  await page.locator('.workspace-results .bathroom-card').filter({ hasText: row.name }).click();
  await expect(page.getByRole('tab', { name: 'Fotos (2)', exact: true })).toBeVisible();
  await expect(page.getByText('Bloco B · 2º andar', { exact: false })).toBeVisible();
  await expect(page.getByText('Acessibilidade não informada', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Visão geral', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Fotos (2)', exact: true })).toHaveAttribute('aria-selected', 'true');
  const cover = await page.locator('.gallery-open img').getAttribute('src');
  const canvas = await page.locator('.maplibregl-canvas').elementHandle();
  await page.getByRole('button', { name: 'Ver foto 2', exact: true }).click();
  const viewer = page.getByRole('region', { name: 'Fotos do banheiro', exact: true });
  await expect(viewer).toBeVisible();
  await expect(viewer).toContainText('Foto 2 de 2');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.gallery-open img')).toHaveAttribute('src', cover!);
  expect(await canvas!.evaluate((el) => el === document.querySelector('.maplibregl-canvas'))).toBe(true);
  const panel = await page.locator('.workspace-panel').boundingBox();
  const photoArea = await page.locator('app-map-photo-viewer').boundingBox();
  expect(photoArea!.x).toBeCloseTo(panel!.x + panel!.width, 0);
  await viewer.getByRole('button', { name: 'Anterior', exact: true }).click();
  await expect(viewer).toContainText('Foto 1 de 2');
  await expect(page.locator('.gallery-open img')).toHaveAttribute('src', cover!);
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();
  await expect(page.getByRole('button', { name: 'Ver foto 2', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Denunciar foto', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cadastre-se', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Denunciar conteúdo', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('tab', { name: /Avaliações \(/ }).click();
  await expect(page.getByText('Ainda sem avaliações. Compartilhe sua experiência.')).toBeVisible();
  await page.getByRole('button', { name: 'Denunciar informações deste local', exact: true }).click();
  await page.getByRole('button', { name: 'Cadastre-se', exact: true }).click();
  await page.getByRole('textbox', { name: 'Nome', exact: true }).fill('Pessoa denunciante');
  await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill(`details-report-${Date.now()}@khki.test`);
  await page.getByLabel('Senha', { exact: true }).fill('Browser-report-password-123');
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await page.getByRole('button', { name: 'Enviar denúncia', exact: true }).click();
  await expect(page.getByText('Obrigado. A denúncia foi recebida para análise.')).toBeVisible();
});
test('unavailable detail recovers and unknown content remains explicit', async ({ page }) => {
  const rows = await (await page.request.get('/api/bathrooms')).json();
  const row = rows[0];
  await page.route('**/api/bathrooms/' + row.id, (route) => route.fulfill({ status: 404, json: { message: 'Local não disponível.' } }));
  await page.goto('/banheiros/' + row.id);
  await expect(page.getByRole('heading', { name: 'Local indisponível', exact: true })).toBeVisible();
  await expect(page.locator('.workspace-results .bathroom-card')).toHaveCount(3);
  await page.unroute('**/api/bathrooms/' + row.id);
  await page.route('**/api/bathrooms/' + row.id, async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...(await response.json()), accessible: false, hours: null, items: [], photoIds: [] } });
  });
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page.locator('.details-panel h1')).toHaveText(row.name);
  await expect(page.getByText('Este local ainda não tem fotos aprovadas.', { exact: true })).toBeVisible();
  await expect(page.getByText('Horário não informado', { exact: true })).toBeVisible();
  await expect(page.getByText('Não acessível', { exact: true })).toBeVisible();
  await expect(page.getByText('Itens não informados', { exact: true })).toBeVisible();
  await expect(page.locator('.workspace-results .bathroom-card')).toHaveCount(3);
  await expect(page.locator('.details-panel').getByText('Aberto agora', { exact: false })).toHaveCount(0);
});
test('direct links and route history move routes to the main sidebar with destination and map preserved', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const rows = await (await page.request.get('/api/bathrooms')).json();
  const row = rows[0];
  await page.goto('/banheiros/' + row.id);
  await expect(page.locator('.workspace-results')).toBeVisible();
  await expect(page.locator('.details-panel h1')).toHaveText(row.name);
  const canvas = await page.locator('.maplibregl-canvas').elementHandle();
  await page.getByRole('link', { name: 'Como chegar', exact: true }).click();
  await expect(page.locator('.workspace-content app-route')).toBeVisible();
  await expect(page.locator('.workspace-results')).toBeHidden();
  expect((await page.locator('.workspace-content').boundingBox())!.x).toBe(0);
  await expect(page.locator('.destination-box')).toContainText(row.name);
  await page.getByRole('combobox', { name: 'Sua origem', exact: true }).fill('Rua de teste, São Paulo');
  await page.getByRole('combobox', { name: 'Sua origem', exact: true }).press('Enter');
  await expect(page.locator('.route-summary')).toBeVisible();
  await page.goBack();
  await expect(page.locator('.details-panel h1')).toHaveText(row.name);
  await page.goForward();
  await expect(page.locator('.route-summary')).toBeVisible();
  expect(await canvas!.evaluate((el) => el === document.querySelector('.maplibregl-canvas'))).toBe(true);
});
test('compact layout uses one panel, both themes and reduced motion without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Expandir painel', exact: true }).click();
  await page.locator('.bathroom-card').first().click();
  await expect(page.locator('.details-panel h1')).toBeVisible();
  await expect(page.locator('.workspace-results')).toBeHidden();
  for (const theme of ['escuro', 'claro']) {
    await page.getByRole('button', { name: 'Abrir sua conta', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Sua conta', exact: true })
      .getByRole('button', { name: theme === 'escuro' ? 'Escuro' : 'Claro', exact: true })
      .click();
    await page.getByRole('button', { name: 'Fechar conta', exact: true }).click();
    await expect(page.locator('.map-loading')).toHaveCount(0);
    expect(await page.locator('.workspace-content').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('.workspace-results')).toBeVisible();
  await expect
    .poll(async () => {
      const pin = await page.locator('.map-marker.is-selected').boundingBox();
      const panel = await page.locator('.workspace-panel').boundingBox();
      return !!pin && !!panel && pin.x > panel.x + panel.width;
    })
    .toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.workspace-results')).toBeHidden();
  await expect
    .poll(async () => {
      const pin = await page.locator('.map-marker.is-selected').boundingBox();
      const panel = await page.locator('.workspace-panel').boundingBox();
      return !!pin && !!panel && pin.y + pin.height < panel.y;
    })
    .toBe(true);
  await page.getByRole('button', { name: 'Expandir painel', exact: true }).click();
  await page.getByRole('button', { name: 'Recolher painel', exact: true }).click();
  await expect(page.locator('.map-workspace')).toHaveClass(/mobile-sheet-peek/);
  await page.getByRole('button', { name: 'Expandir painel', exact: true }).click();
  await page.getByRole('link', { name: 'Fechar detalhes', exact: true }).click();
  await expect(page.locator('.workspace-results')).toBeVisible();
});

test('details slide from behind results and retract before routes occupy the main sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await expect(page.locator('.bathroom-card')).toHaveCount(3);
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--motion-panel-duration', '600ms');
    const runtime = window as unknown as { panelSamples: number[] };
    runtime.panelSamples = [];
    const start = performance.now();
    const sample = () => {
      const panel = document.querySelector('.detail-scene .workspace-content');
      if (panel) runtime.panelSamples.push(panel.getBoundingClientRect().x);
      if (performance.now() - start < 2000) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  const canvas = await page.locator('.maplibregl-canvas').elementHandle();
  await page.locator('.bathroom-card').first().click();
  await expect(page.locator('.details-panel h1')).toBeVisible();
  await page.waitForTimeout(700);
  const samples = await page.evaluate(() => (window as unknown as { panelSamples: number[] }).panelSamples);
  const width = (await page.locator('.workspace-results').boundingBox())!.width;
  expect(Math.min(...samples)).toBeLessThan(width * 0.8);
  expect(Math.max(...samples)).toBeCloseTo(width, 0);
  const started = Date.now();
  await page.getByRole('link', { name: 'Como chegar', exact: true }).click();
  await expect(page.locator('.workspace-content app-route')).toBeVisible();
  expect(Date.now() - started).toBeGreaterThanOrEqual(500);
  await expect(page.locator('.workspace-results')).toBeHidden();
  expect((await page.locator('.workspace-content').boundingBox())!.x).toBe(0);
  expect(await canvas!.evaluate((el) => el === document.querySelector('.maplibregl-canvas'))).toBe(true);
  await page.goBack();
  await expect(page.locator('.workspace-results')).toBeVisible();
  await expect(page.locator('.details-panel h1')).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('link', { name: 'Como chegar', exact: true }).press('Enter');
  await expect(page.locator('.workspace-content app-route')).toBeVisible();
  await expect(page.locator('.workspace-results')).toBeHidden();
});
test('selecting another bathroom during panel exit cancels navigation to the old destination', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await expect(page.locator('.bathroom-card')).toHaveCount(3);
  await page.evaluate(() => document.documentElement.style.setProperty('--motion-panel-duration', '900ms'));
  await page.locator('.bathroom-card').first().click();
  await expect(page.locator('.details-panel h1')).toBeVisible();
  await page.waitForTimeout(950);
  await page.getByRole('link', { name: 'Como chegar', exact: true }).click();
  const next = page.locator('.workspace-results .bathroom-card').nth(1);
  const name = await next.locator('h3').innerText();
  await next.click();
  await expect(page.locator('.details-panel h1')).toHaveText(name);
  await page.waitForTimeout(1000);
  await expect(page.locator('.details-panel h1')).toHaveText(name);
  await expect(page.locator('app-route')).toHaveCount(0);
  await expect(page.getByText('Não foi possível abrir a rota. Tente novamente.', { exact: true })).toHaveCount(0);
});

test('mobile photo area handles unavailable images, preserves the cover and restores the details panel', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const rows = await (await page.request.get('/api/bathrooms')).json();
  const row = rows[0];
  await page.goto('/');
  const image = await page.screenshot();
  await page.route('**/api/bathrooms/' + row.id, async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...(await response.json()), photoIds: ['mobile-cover', 'mobile-unavailable'] } });
  });
  await page.route('**/api/photos/mobile-cover', (route) => route.fulfill({ contentType: 'image/png', body: image }));
  await page.route('**/api/photos/mobile-unavailable', (route) => route.fulfill({ status: 404 }));
  await page.getByRole('button', { name: 'Expandir painel', exact: true }).click();
  await page.locator('.bathroom-card').filter({ hasText: row.name }).click();
  await page.getByRole('button', { name: 'Expandir painel', exact: true }).click();
  await expect(page.locator('.mobile-detail-photos img').first()).toBeVisible();
  const canvas = await page.locator('.maplibregl-canvas').elementHandle();
  const cover = await page.locator('.mobile-detail-photos img').first().getAttribute('src');
  await page.getByRole('tab', { name: 'Fotos (2)', exact: true }).click();
  await page.getByRole('button', { name: 'Ver foto 2', exact: true }).click();
  const viewer = page.getByRole('region', { name: 'Fotos do banheiro', exact: true });
  await expect(viewer).toBeVisible();
  await expect(page.locator('.workspace-panel')).toBeHidden();
  await expect(viewer.getByRole('status')).toContainText('Foto indisponível');
  await expect(page.locator('.mobile-detail-photos img').first()).toHaveAttribute('src', cover!);
  await viewer.getByRole('button', { name: 'Exibir foto 1', exact: true }).click();
  await expect(viewer.locator('.photo-viewer-stage img')).toBeVisible();
  await viewer.getByRole('button', { name: 'Denunciar foto exibida', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cadastre-se', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Denunciar conteúdo', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(viewer).toBeVisible();
  await viewer.getByRole('button', { name: 'Voltar ao mapa', exact: true }).click();
  await expect(viewer).toHaveCount(0);
  await expect(page.locator('.workspace-panel')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ver foto 2', exact: true })).toBeFocused();
  expect(await canvas!.evaluate((el) => el === document.querySelector('.maplibregl-canvas'))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
