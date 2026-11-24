import { expect, Page, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

async function administrator(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('E-mail', { exact: true }).fill(process.env['KHKI_TEST_ADMIN_EMAIL']!);
  await dialog.getByLabel('Senha', { exact: true }).fill(process.env['KHKI_TEST_ADMIN_PASSWORD']!);
  await dialog.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Moderação', exact: true })).toBeVisible();
}
async function headers(page: Page): Promise<Record<string, string>> {
  await page.request.get('/api/auth/csrf');
  const cookie = (await page.context().cookies()).find((cookie) => cookie.name === 'XSRF-TOKEN');
  return { 'X-XSRF-TOKEN': decodeURIComponent(cookie!.value) };
}
async function pendingBathroom(page: Page, suffix: string): Promise<{ id: string; name: string }> {
  const name = 'Café do Centro · ' + suffix + ' ' + Date.now();
  const response = await page.request.post('/api/bathrooms', {
    headers: await headers(page),
    data: { name, address: 'Rua Augusta, 1234 — Consolação, São Paulo', complement: 'Bloco B, piso L2', category: 'Cafeteria', latitude: -23.5536, longitude: -46.6558, access: 'FREE', accessDetails: 'Livre para visitantes', hours: 'Todos os dias, 08:00 às 20:00', accessible: true, items: ['SOAP', 'SINK', 'BIN'] }
  });
  expect(response.status()).toBe(201);
  return { id: (await response.json()).id, name };
}
async function moderationVersion(page: Page, type: 'BATHROOM' | 'REVIEW', id: string): Promise<number> {
  const response = await page.request.get('/api/admin/content/' + type + '/' + id);
  expect(response.ok()).toBe(true);
  return (await response.json()).version;
}

test.beforeEach(async ({ page }) => {
  test.skip(!process.env['KHKI_TEST_ADMIN_PASSWORD'] || !process.env['KHKI_MAPS_SIMULATION_URL'], 'Execute npm test para usar API e mapas isolados.');
  const simulation = process.env['KHKI_MAPS_SIMULATION_URL'];
  await page.route('**/config.js', (route) => route.fulfill({ contentType: 'application/javascript', body: `window.KHKI_CONFIG = ${JSON.stringify({ geoapifyApiKey: 'simulation-key', geoapifyApiBaseUrl: simulation + '/v1', geoapifyMapsBaseUrl: simulation + '/v1' })};` }));
});

test('Preserva filtros da moderação, compara registros próximos reais e solicita informações de forma privada', async ({ page, browser }) => {
  await administrator(page);
  const bathroom = await pendingBathroom(page, 'Revisão');
  const picture = await page.request.post('/api/bathrooms/' + bathroom.id + '/photos?registrationAttachment=true', { headers: await headers(page), multipart: { file: { name: 'banheiro.jpg', mimeType: 'image/jpeg', buffer: readFileSync('../data/demo-regional/images/anexo-01.jpg') } } });
  expect(picture.status()).toBe(201);
  const own = await (await page.request.get('/api/me/contributions/BATHROOM/' + bathroom.id)).json();
  const photoId = own.photoIds[0];
  await page.getByRole('link', { name: 'Moderação', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Categorias de moderação' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Moderação', exact: true })).toHaveCount(0);
  const sidebar = await page.locator('.moderation-sidebar').boundingBox();
  const content = await page.locator('.moderation-page').boundingBox();
  const search = await page.locator('.queue-toolbar').boundingBox();
  expect(sidebar!.x + sidebar!.width).toBeLessThanOrEqual(content!.x);
  expect(search!.y - content!.y).toBeLessThanOrEqual(32);
  const categoryButtons = page.getByRole('navigation', { name: 'Categorias de moderação' }).getByRole('button');
  expect((await categoryButtons.nth(1).boundingBox())!.y).toBeGreaterThan((await categoryButtons.first().boundingBox())!.y);
  await page.getByRole('textbox', { name: 'Buscar contribuições' }).fill(bathroom.name);
  await page.getByRole('combobox', { name: 'Ordenação por data' }).selectOption('oldest');
  await page.getByRole('button', { name: 'Ativar modo escuro', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Analisar ' + bathroom.name, exact: true })).toBeVisible();
  await page.screenshot({ path: '../test-results/moderation-dark-queue.png', fullPage: true });
  await page.getByRole('button', { name: 'Analisar ' + bathroom.name, exact: true }).click();
  await expect(page.getByText('Bloco B, piso L2', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Comparar cadastro', exact: true })).toBeVisible();
  await expect(page.locator('.map-marker.is-reference')).toHaveCount(1);
  await expect(page.locator('.map-marker.is-existing')).toHaveCount(1);
  const canvas = await page.locator('.maplibregl-canvas').elementHandle();
  await page.getByRole('button', { name: 'Comparar cadastro', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Comparação de cadastros' })).toBeVisible();
  expect(await canvas!.evaluate((element) => element === document.querySelector('.maplibregl-canvas'))).toBe(true);
  await expect(page.getByRole('button', { name: 'Ampliar foto anexada', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ampliar foto anexada', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Foto ampliada para moderação' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.screenshot({ path: '../test-results/moderation-dark-review.png', fullPage: true });
  await page.getByRole('button', { name: 'Ativar modo claro', exact: true }).click();
  await page.screenshot({ path: '../test-results/moderation-light-review.png', fullPage: true });
  await page.getByRole('button', { name: 'Voltar à fila', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Buscar contribuições' })).toHaveValue(bathroom.name);
  await expect(page.getByRole('combobox', { name: 'Ordenação por data' })).toHaveValue('oldest');
  await page.getByRole('button', { name: 'Analisar ' + bathroom.name, exact: true }).click();
  await page.getByRole('textbox', { name: 'Motivo da decisão ou encerramento' }).fill('Informe se há elevador para acesso ao piso L2.');
  await page.getByRole('button', { name: 'Solicitar informações', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Solicitar informações' });
  await dialog.getByRole('button', { name: 'Solicitar informações', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Decisão registrada');
  await expect(page.locator('.review-content').getByText('Aguardando informações', { exact: true }).first()).toBeVisible();
  await expect(page.locator('.review-history')).toContainText('Informe se há elevador');
  const visitor = await browser.newContext();
  expect((await visitor.request.get(new URL('/api/bathrooms/' + bathroom.id, page.url()).href)).status()).toBe(404);
  expect((await visitor.request.get(new URL('/api/photos/' + photoId, page.url()).href)).status()).toBe(404);
  await visitor.close();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.moderation-shell')).toHaveClass(/sidebar-collapsed/);
  await page.locator('.moderation-shell').evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished));
  });
  await expect(page.getByRole('heading', { name: 'Moderação no desktop', exact: true })).toBeVisible();
  await expect(page.locator('.review-content')).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator('.review-content')).toBeVisible();
  await expect(page.locator('.review-content')).toContainText('Aguardando informações');
});

test('Rejeita duplicados com auditoria vinculada e bloqueia decisões de moderação desatualizadas', async ({ page }) => {
  await administrator(page);
  const bathroom = await pendingBathroom(page, 'Duplicata');
  await page.goto('/admin');
  await page.getByRole('textbox', { name: 'Buscar contribuições' }).fill(bathroom.name);
  await page.getByRole('button', { name: 'Analisar ' + bathroom.name, exact: true }).click();
  const duplicate = page.getByRole('combobox', { name: 'Se a rejeição for por duplicidade' });
  await expect(duplicate).toBeVisible();
  const options = await duplicate.locator('option').evaluateAll((elements) => elements.map((element) => (element as HTMLOptionElement).value));
  await duplicate.selectOption(options[1]);
  await page.getByRole('textbox', { name: 'Motivo da decisão ou encerramento' }).fill('Mesmo banheiro, confirmado após comparar o complemento.');
  await page.getByRole('button', { name: 'Rejeitar', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar rejeição', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Decisão registrada');
  await expect(page.locator('.review-history')).toContainText(options[1]);
  const another = await pendingBathroom(page, 'Concorrência');
  await page.goto('/admin');
  await page.getByRole('textbox', { name: 'Buscar contribuições' }).fill(another.name);
  await page.getByRole('button', { name: 'Analisar ' + another.name, exact: true }).click();
  await expect(page.getByRole('button', { name: 'Aprovar cadastro', exact: true })).toBeVisible();
  const response = await page.request.post('/api/admin/content/BATHROOM/' + another.id + '/decision', { headers: await headers(page), data: { status: 'REJECTED', reason: 'Decisão concorrente de outro administrador.', expectedVersion: await moderationVersion(page, 'BATHROOM', another.id) } });
  expect(response.ok()).toBe(true);
  await page.getByRole('textbox', { name: 'Motivo da decisão ou encerramento' }).fill('Tentativa com versão antiga.');
  await page.getByRole('button', { name: 'Aprovar cadastro', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar aprovação', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('alterou este item');
  await expect(page.getByRole('button', { name: 'Aprovar cadastro', exact: true })).toBeDisabled();
  await page.getByRole('alert').getByRole('button', { name: 'Atualizar análise', exact: true }).click();
  await expect(page.locator('.review-content').getByText('Rejeitado', { exact: true }).first()).toBeVisible();
});

test('Oculta o conteúdo denunciado de forma atômica e bloqueia a administração para usuários comuns', async ({ page, browser }) => {
  await administrator(page);
  const bathroom = await pendingBathroom(page, 'Denúncia');
  expect((await page.request.post('/api/admin/content/BATHROOM/' + bathroom.id + '/decision', { headers: await headers(page), data: { status: 'APPROVED', reason: 'Cadastro aprovado para testar denúncia.', expectedVersion: await moderationVersion(page, 'BATHROOM', bathroom.id) } })).ok()).toBe(true);
  expect((await page.request.post('/api/reports', { headers: await headers(page), data: { targetType: 'BATHROOM', targetId: bathroom.id, reason: 'INCORRECT' } })).status()).toBe(202);
  await page.goto('/admin');
  await page.getByRole('button', { name: /^Denúncias \(/ }).click();
  await page.getByRole('textbox', { name: 'Buscar contribuições' }).fill(bathroom.name);
  await page.getByRole('button', { name: 'Analisar ' + bathroom.name, exact: true }).click();
  await page.getByRole('textbox', { name: 'Motivo da decisão ou encerramento' }).fill('Informação incorreta confirmada na revisão.');
  await page.getByRole('button', { name: 'Ocultar conteúdo', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar ocultação', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Decisão registrada');
  const visitor = await browser.newContext();
  expect((await visitor.request.get(new URL('/api/bathrooms/' + bathroom.id, page.url()).href)).status()).toBe(404);
  const outsider = await visitor.newPage();
  await outsider.goto(new URL('/', page.url()).href);
  const credentials = { email: 'common-moderation-' + Date.now() + '@khki.test', password: 'Moderation-user-password-123' };
  const origin = new URL('/', page.url()).href;
  expect((await visitor.request.post(origin + 'api/auth/register', { headers: await headers(outsider), data: { name: 'Pessoa sem acesso administrativo', ...credentials } })).status()).toBe(201);
  expect((await visitor.request.post(origin + 'api/auth/login', { headers: await headers(outsider), data: credentials })).ok()).toBe(true);
  await outsider.goto(new URL('/admin', page.url()).href);
  await expect(outsider).toHaveURL(/\/$/);
  expect((await visitor.request.get(new URL('/api/admin/queue/details', page.url()).href)).status()).toBe(403);
  await visitor.close();
});

test('Anima a barra de moderação, alterna apenas pelo espaço livre ou rodapé e respeita movimento reduzido', async ({ page }) => {
  await administrator(page);
  let queueRequests = 0;
  page.on('request', (request) => {
    if (request.url().includes('/api/admin/queue/details')) queueRequests++;
  });
  await page.goto('/admin');
  await expect(page.getByRole('navigation', { name: 'Categorias de moderação' })).toBeVisible();
  const shell = page.locator('.moderation-shell');
  const sidebar = page.locator('.moderation-sidebar');
  const input = page.getByRole('textbox', { name: 'Buscar contribuições' });
  await input.fill('Filtro preservado');
  const width = (await sidebar.boundingBox())!.width;
  const icon = await page.locator('.moderation-sidebar-arrow').elementHandle();
  const originalRotation = await icon!.evaluate((element) => getComputedStyle(element).transform);
  await sidebar.hover({ position: { x: width / 2, y: (await sidebar.boundingBox())!.height * 0.6 } });
  await expect(sidebar).toHaveCSS('cursor', 'ew-resize');
  await page.evaluate(() => {
    const runtime = window as unknown as { sidebarMotion: { active: boolean; widths: number[] } };
    runtime.sidebarMotion = { active: true, widths: [] };
    const sample = () => {
      const element = document.querySelector('.moderation-sidebar');
      if (!runtime.sidebarMotion.active || !element) return;
      runtime.sidebarMotion.widths.push(element.getBoundingClientRect().width);
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await sidebar.click({ position: { x: width / 2, y: (await sidebar.boundingBox())!.height * 0.6 } });
  await expect(page.getByRole('button', { name: 'Expandir categorias de moderação', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await shell.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished));
  });
  const frames = await page.evaluate(() => {
    const runtime = window as unknown as { sidebarMotion: { active: boolean; widths: number[] } };
    runtime.sidebarMotion.active = false;
    return new Set(runtime.sidebarMotion.widths.map((width) => Math.round(width))).size;
  });
  expect(frames).toBeGreaterThan(2);
  expect((await sidebar.boundingBox())!.width).toBeLessThan(width);
  expect(await icon!.evaluate((element) => element === document.querySelector('.moderation-sidebar-arrow'))).toBe(true);
  expect(await icon!.evaluate((element) => getComputedStyle(element).transform)).not.toBe(originalRotation);
  const expand = page.getByRole('button', { name: 'Expandir categorias de moderação', exact: true });
  await expand.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Minimizar categorias de moderação', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await shell.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished));
  });
  await page
    .getByRole('navigation', { name: 'Categorias de moderação' })
    .getByRole('button', { name: /^Avaliações \(/ })
    .click();
  await expect(shell).not.toHaveClass(/sidebar-collapsed/);
  await expect(input).toHaveValue('Filtro preservado');
  expect(queueRequests).toBe(1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Minimizar categorias de moderação', exact: true }).click();
  await expect(shell).toHaveCSS('transition-property', 'none');
  await expect(page.locator('.moderation-sidebar-arrow')).toHaveCSS('transition-property', 'none');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'Moderação no desktop', exact: true })).toBeVisible();
  await expect(input).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '../test-results/moderation-mobile-restricted.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Expandir categorias de moderação', exact: true }).click();
  await expect(input).toHaveValue('Filtro preservado');
});

test('Publica fotos junto com o cadastro e a avaliação e bloqueia envio e moderação avulsos', async ({ page, browser }) => {
  await administrator(page);
  const registration = await pendingBathroom(page, 'Anexos do cadastro');
  const reviewParent = await pendingBathroom(page, 'Anexo da avaliação');
  const approveContext = await page.request.post('/api/admin/content/BATHROOM/' + reviewParent.id + '/decision', { headers: await headers(page), data: { status: 'APPROVED', reason: 'Contexto aprovado para avaliação com foto.', expectedVersion: await moderationVersion(page, 'BATHROOM', reviewParent.id) } });
  expect(approveContext.ok()).toBe(true);
  const sendPhoto = async (bathroomId: string, query: string) => page.request.post('/api/bathrooms/' + bathroomId + '/photos' + query, { headers: await headers(page), multipart: { file: { name: 'foto.jpg', mimeType: 'image/jpeg', buffer: readFileSync('../data/demo-regional/images/anexo-01.jpg') } } });
  for (let index = 0; index < 2; index++) {
    const response = await sendPhoto(registration.id, '?registrationAttachment=true');
    expect(response.status()).toBe(201);
    expect((await response.json()).id).toBe(registration.id);
  }
  const registrationPhotos: string[] = (await (await page.request.get('/api/me/contributions/BATHROOM/' + registration.id)).json()).photoIds;
  expect(registrationPhotos).toHaveLength(2);
  const review = await page.request.post('/api/bathrooms/' + reviewParent.id + '/reviews', { headers: await headers(page), data: { cleanliness: 3, structure: 4, comment: 'Avaliação com anexo.' } });
  expect(review.status()).toBe(201);
  const reviewId = (await review.json()).id;
  const reviewPhoto = await sendPhoto(reviewParent.id, '?reviewId=' + reviewId);
  expect(reviewPhoto.status()).toBe(201);
  expect((await reviewPhoto.json()).id).toBe(reviewId);
  const reviewDetail = await (await page.request.get('/api/admin/content/REVIEW/' + reviewId)).json();
  const reviewPhotos: string[] = reviewDetail.photos.map((photo: { id: string }) => photo.id);
  expect(reviewPhotos).toHaveLength(1);
  const standalone = await sendPhoto(reviewParent.id, '');
  expect(standalone.status()).toBe(400);
  expect((await standalone.json()).detail).toContain('Fotos avulsas não são permitidas');
  const individualReport = await page.request.post('/api/reports', { headers: await headers(page), data: { targetType: 'PHOTO', targetId: registrationPhotos[0], reason: 'INAPPROPRIATE' } });
  expect(individualReport.status()).toBe(400);
  const individualDecision = await page.request.post('/api/admin/content/PHOTO/' + registrationPhotos[0] + '/decision', { headers: await headers(page), data: { status: 'REJECTED', reason: 'Não deve existir moderação individual de fotos.' } });
  expect(individualDecision.status()).toBe(400);
  const visitor = await browser.newContext();
  try {
    for (const id of [...registrationPhotos, ...reviewPhotos]) expect((await visitor.request.get(new URL('/api/photos/' + id, page.url()).href)).status()).toBe(404);
    await page.getByRole('link', { name: 'Moderação', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Fotos \(/ })).toHaveCount(0);
    const queue = await (await page.request.get('/api/admin/queue')).json();
    expect(queue.filter((row: { id: string }) => [registration.id, reviewId].includes(row.id))).toHaveLength(2);
    expect(queue.every((row: { type: string }) => ['BATHROOM', 'REVIEW'].includes(row.type))).toBe(true);
    await page.getByRole('textbox', { name: 'Buscar contribuições' }).fill(registration.name);
    await page.getByRole('button', { name: 'Analisar ' + registration.name, exact: true }).click();
    await expect(page.locator('.review-photos')).toContainText('Fotos enviadas (2)');
    await expect(page.getByRole('button', { name: 'Rejeitar foto', exact: true })).toHaveCount(0);
    await page.getByRole('textbox', { name: 'Motivo da decisão ou encerramento' }).fill('Cadastro e fotos conferidos.');
    await page.getByRole('button', { name: 'Aprovar cadastro', exact: true }).click();
    const confirmation = page.getByRole('dialog', { name: 'Confirmar aprovação' });
    await expect(confirmation).toContainText('fotos pendentes anexadas');
    await confirmation.getByRole('button', { name: 'Confirmar aprovação', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Decisão registrada');
    for (const id of registrationPhotos) expect((await visitor.request.get(new URL('/api/photos/' + id, page.url()).href)).status()).toBe(200);
    expect((await visitor.request.get(new URL('/api/photos/' + reviewPhotos[0], page.url()).href)).status()).toBe(404);
    await page.getByRole('button', { name: 'Voltar à fila', exact: true }).click();
    await page.getByRole('button', { name: /^Avaliações \(/ }).click();
    await page.getByRole('textbox', { name: 'Buscar contribuições' }).fill(reviewParent.name);
    await page.getByRole('button', { name: 'Analisar Avaliação: ' + reviewParent.name, exact: true }).click();
    await expect(page.locator('.review-photos')).toContainText('Fotos enviadas (1)');
    await page.getByRole('textbox', { name: 'Motivo da decisão ou encerramento' }).fill('Avaliação e foto conferidas.');
    await page.getByRole('button', { name: 'Aprovar', exact: true }).click();
    await page.getByRole('dialog', { name: 'Confirmar aprovação' }).getByRole('button', { name: 'Confirmar aprovação', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Decisão registrada');
    expect((await visitor.request.get(new URL('/api/photos/' + reviewPhotos[0], page.url()).href)).status()).toBe(200);
  } finally {
    await visitor.close();
    for (const id of [registration.id, reviewParent.id]) {
      const detail = await (await page.request.get('/api/admin/content/BATHROOM/' + id)).json();
      if (detail.contribution.status !== 'APPROVED') continue;
      const response = await page.request.post('/api/admin/content/BATHROOM/' + id + '/decision', { headers: await headers(page), data: { status: 'HIDDEN', reason: 'Limpeza dos registros publicados pelo teste de anexos.', expectedVersion: await moderationVersion(page, 'BATHROOM', id) } });
      expect(response.ok()).toBe(true);
    }
  }
});
