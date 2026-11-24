import { expect, Page, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const bathroom = { id: 'review-form', name: 'Biblioteca Municipal — banheiro próximo à entrada e à recepção principal', address: 'Rua das Flores, Indaiatuba', category: 'Biblioteca', latitude: -23.1, longitude: -47.2, access: 'FREE', hours: 'Não informado', items: [], photoIds: [], rating: 0, reviewCount: 0 };
const photo = { name: 'banheiro.jpg', mimeType: 'image/jpeg', buffer: readFileSync('../data/demo-regional/images/anexo-01.jpg') };
async function prepare(page: Page): Promise<void> {
  await page.route('**/config.js', (route) => route.fulfill({ contentType: 'application/javascript', body: 'window.KHKI_CONFIG={geoapifyApiKey:""};' }));
  await page.route('**/api/auth/csrf', (route) => route.fulfill({ json: {} }));
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: { id: 'review-user', name: 'Pessoa Teste', role: 'USER' } }));
  await page.route(/\/api\/bathrooms(?:\?.*)?$/, (route) => route.fulfill({ json: [bathroom] }));
  await page.route('**/api/bathrooms/' + bathroom.id, (route) => route.fulfill({ json: bathroom }));
  await page.route('**/api/bathrooms/' + bathroom.id + '/reviews', (route) => route.fulfill({ json: [] }));
  await page.goto('/banheiros/' + bathroom.id + '/avaliar');
  await expect(page.getByRole('heading', { name: 'Avaliar banheiro.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Limpeza: 1 de 5', exact: true })).toBeVisible();
}
async function rate(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Limpeza: 4 de 5', exact: true }).click();
  await page.getByRole('button', { name: 'Estrutura: 3 de 5', exact: true }).click();
}

test('Inicia sem notas, permite seleção por teclado, preserva limites e retorna ao banheiro', async ({ page }) => {
  await prepare(page);
  const send = page.getByRole('button', { name: 'Enviar avaliação', exact: true });
  await expect(send).toBeDisabled();
  await expect(page.getByRole('button', { pressed: true })).toHaveCount(0);
  await expect(page.getByText('Selecione as duas notas para enviar.')).toBeVisible();
  await page.getByRole('button', { name: 'Limpeza: 4 de 5', exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(page.getByText('4 de 5 · Boa', { exact: true })).toBeVisible();
  await expect(send).toBeDisabled();
  await page.getByRole('button', { name: 'Estrutura: 3 de 5', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('3 de 5 · Regular', { exact: true })).toBeVisible();
  await expect(send).toBeEnabled();
  await expect(page.getByRole('textbox', { name: 'Sua experiência' })).toHaveAttribute('maxlength', '1500');
  for (const button of await page.locator('.rating-picker button').all()) {
    const box = (await button.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole('link', { name: 'Voltar ao banheiro', exact: true }).click();
  await expect(page).toHaveURL(/\/banheiros\/review-form$/);
});

test('Valida, exibe, substitui e remove a foto, preservando o limite de um arquivo', async ({ page }) => {
  await prepare(page);
  const input = page.locator('app-review input[type=file]');
  await input.setInputFiles({ name: 'texto.txt', mimeType: 'text/plain', buffer: Buffer.from('arquivo inválido') });
  await expect(page.getByRole('alert')).toHaveText('Escolha uma foto JPG ou PNG com até 5 MB.');
  await expect(page.getByAltText('Prévia da foto selecionada')).toHaveCount(0);
  await input.setInputFiles({ ...photo, buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
  await expect(page.getByRole('alert')).toBeVisible();
  await input.setInputFiles(photo);
  await expect(page.getByAltText('Prévia da foto selecionada')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await input.setInputFiles({ ...photo, name: 'substituta.jpg' });
  await expect(page.getByText('substituta.jpg')).toBeVisible();
  await expect(page.getByAltText('Prévia da foto selecionada')).toHaveCount(1);
  await page.getByRole('button', { name: 'Remover foto' }).click();
  await expect(page.getByAltText('Prévia da foto selecionada')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Adicionar foto' })).toBeVisible();
});

test('Preserva campos e foto em falhas, bloqueia o envio em andamento e permite nova tentativa', async ({ page }) => {
  await prepare(page);
  await rate(page);
  await page.getByRole('textbox', { name: 'Sua experiência' }).fill('Limpo, com itens conservados.');
  await page.locator('app-review input[type=file]').setInputFiles(photo);
  let requests = 0;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/bathrooms/review-form/reviews', async (route) => {
    requests++;
    expect(route.request().postDataJSON()).toEqual({ cleanliness: 4, structure: 3, comment: 'Limpo, com itens conservados.' });
    if (requests === 1) {
      await pending;
      await route.fulfill({ status: 503, json: { detail: 'Serviço indisponível. Tente novamente.' } });
    } else await route.fulfill({ json: { id: 'saved-review', status: 'PENDING' } });
  });
  let uploads = 0;
  await page.route('**/api/bathrooms/review-form/photos?reviewId=saved-review', (route) => {
    uploads++;
    return route.fulfill({ json: {} });
  });
  await page.getByRole('button', { name: 'Enviar avaliação', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Enviando…' })).toBeDisabled();
  await expect(page.getByRole('textbox', { name: 'Sua experiência' })).toBeDisabled();
  expect(requests).toBe(1);
  release();
  await expect(page.getByRole('alert')).toHaveText('Serviço indisponível. Tente novamente.');
  await expect(page.getByRole('textbox', { name: 'Sua experiência' })).toHaveValue('Limpo, com itens conservados.');
  await expect(page.getByAltText('Prévia da foto selecionada')).toBeVisible();
  await page.getByRole('button', { name: 'Enviar avaliação', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Avaliação em análise' })).toBeVisible();
  expect(requests).toBe(2);
  expect(uploads).toBe(1);
});

test('Envia campos opcionais vazios sem anexar foto e mantém o aviso de sucesso após falha parcial no envio', async ({ page }) => {
  await prepare(page);
  await rate(page);
  let body: unknown;
  await page.route('**/api/bathrooms/review-form/reviews', (route) => {
    body = route.request().postDataJSON();
    return route.fulfill({ json: { id: 'saved-review', status: 'PENDING' } });
  });
  await page.getByRole('button', { name: 'Enviar avaliação', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Avaliação em análise' })).toBeVisible();
  expect(body).toEqual({ cleanliness: 4, structure: 3, comment: '' });
  await page.getByRole('link', { name: 'Voltar ao banheiro', exact: true }).click();
  await page.goto('/banheiros/review-form/avaliar');
  await rate(page);
  await page.locator('app-review input[type=file]').setInputFiles(photo);
  await page.route('**/api/bathrooms/review-form/photos?reviewId=saved-review', (route) => route.fulfill({ status: 400, json: { detail: 'Foto recusada.' } }));
  await page.getByRole('button', { name: 'Enviar avaliação', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Avaliação em análise' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveText('Avaliação salva. A foto não foi enviada: Foto recusada.');
});

test('Permite rolar o formulário no celular com tela pequena, fontes ampliadas e temas, sem transbordamento externo', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await prepare(page);
  await rate(page);
  for (const theme of ['dark', 'light']) {
    await page.evaluate((value) => {
      document.documentElement.dataset['theme'] = value;
    }, theme);
    await page.addStyleTag({ content: 'html { font-size: 20px; }' });
    await page.getByRole('textbox', { name: 'Sua experiência' }).fill('Comentário em tela pequena.');
    await page.getByRole('button', { name: 'Enviar avaliação', exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Enviar avaliação', exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
    await page.screenshot({ path: `../test-results/review-mobile-${theme}.png` });
  }
  await page.setViewportSize({ width: 393, height: 420 });
  await page.getByRole('textbox', { name: 'Sua experiência' }).focus();
  await expect(page.getByRole('textbox', { name: 'Sua experiência' })).toBeInViewport();
  await page.screenshot({ path: '../test-results/review-short-viewport.png' });
});

test('Preserva o painel lateral no computador e no celular com superfície única e título completo', async ({ page }) => {
  await prepare(page);
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 393, height: 852 },
    { width: 852, height: 393 }
  ]) {
    await page.setViewportSize(viewport);
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => {
        document.documentElement.dataset['theme'] = value;
      }, theme);
      await page.getByRole('link', { name: 'Voltar ao banheiro', exact: true }).scrollIntoViewIfNeeded();
      await expect(page.locator('app-review .surface')).toHaveCount(0);
      await expect(page.locator('.review-heading p')).toHaveText(bathroom.name);
      await expect(page.getByRole('link', { name: 'Voltar ao banheiro', exact: true })).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `../test-results/review-${viewport.width}-${theme}.png` });
    }
  }
});

test.describe('Interação por toque', () => {
  test.use({ viewport: { width: 393, height: 852 }, hasTouch: true });
  test('Seleciona as notas por toque sem arrastar o painel do celular', async ({ page }) => {
    await prepare(page);
    await page.getByRole('button', { name: 'Limpeza: 4 de 5', exact: true }).tap();
    await page.getByRole('button', { name: 'Estrutura: 3 de 5', exact: true }).tap();
    await expect(page.getByText('4 de 5 · Boa', { exact: true })).toBeVisible();
    await expect(page.getByText('3 de 5 · Regular', { exact: true })).toBeVisible();
    await expect(page.locator('.map-workspace')).toHaveClass(/mobile-sheet-full/);
  });
});
