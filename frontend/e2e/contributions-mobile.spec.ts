import { expect, Page, test } from '@playwright/test';

test.use({ viewport: { width: 393, height: 852 }, hasTouch: true });
const rows = [
  { id: '1', type: 'PHOTO', title: 'Foto: Foto: Apoio ao Viajante', status: 'PENDING', reason: null, createdAt: '2026-11-02T12:00:00Z', bathroomId: 'bathroom' },
  { id: '2', type: 'BATHROOM', title: 'Biblioteca Municipal', status: 'APPROVED', reason: 'Cadastro aprovado.', createdAt: '2026-11-01T12:00:00Z', bathroomId: 'bathroom' },
  { id: '3', type: 'REVIEW', title: 'Avaliação: Parque Ecológico', status: 'REJECTED', reason: 'Confira as informações. '.repeat(25) + '<img src=x onerror=alert(1)>', createdAt: '2026-10-31T12:00:00Z', bathroomId: 'bathroom' },
  { id: '4', type: 'PHOTO', title: 'Foto: Terminal', status: 'APPROVED', reason: 'Aprovada junto com o cadastro do banheiro 920e3f5b-9a13-47db-a9f6-863a53ff19f3.', createdAt: '2026-10-30T12:00:00Z', bathroomId: 'bathroom' },
  { id: '5', type: 'BATHROOM', title: 'Nome muito extenso de um espaço público '.repeat(4), status: 'NEEDS_INFORMATION', reason: 'Informe o acesso.', createdAt: '2026-10-29T12:00:00Z', bathroomId: 'bathroom' },
  { id: '6', type: 'PHOTO', title: 'Foto: ', status: 'HIDDEN', reason: null, createdAt: '2026-10-28T12:00:00Z', bathroomId: 'bathroom' },
  { id: '7', type: 'REVIEW', title: 'Avaliação: Praça', status: 'REMOVED', reason: null, createdAt: '2026-10-27T12:00:00Z', bathroomId: 'bathroom' }
];
async function auth(page: Page): Promise<void> {
  await page.route('**/api/auth/csrf', route => route.fulfill({ json: {} }));
  await page.route('**/api/auth/me', route => route.fulfill({ json: { id: 'test', name: 'Pessoa Teste', role: 'USER' } }));
}
async function open(page: Page, data = rows): Promise<void> {
  await auth(page);
  await page.route('**/api/me/contributions', route => route.fulfill({ json: data }));
  await page.goto('/contribuicoes');
  await expect(page.locator('.contributions-count')).toBeVisible();
}
test('combined filters, sorting, count and clearing stay on one page', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('khki-theme', 'dark'));
  await open(page);
  await page.screenshot({ path: '../test-results/contributions-mobile-dark.png' });
  await expect(page.locator('.contributions-count')).toHaveText('7 contribuições');
  await expect(page.locator('.contributions-info h2').first()).toHaveText('Apoio ao Viajante');
  await page.getByRole('button', { name: 'Fotos', exact: true }).click();
  await expect(page.locator('.contributions-count')).toHaveText('3 contribuições');
  await page.getByRole('combobox', { name: 'Status da contribuição' }).selectOption('APPROVED');
  await expect(page.locator('.contributions-count')).toHaveText('1 contribuição');
  await expect(page.locator('.contributions-info h2')).toHaveText('Terminal');
  await page.getByRole('combobox', { name: 'Status da contribuição' }).selectOption('REJECTED');
  await page.getByRole('button', { name: 'Limpar filtros' }).click();
  await page.getByRole('combobox', { name: 'Ordenar contribuições' }).selectOption('oldest');
  await expect(page.locator('.contributions-info h2').first()).toHaveText('Praça');
  await expect(page).toHaveURL(/\/contribuicoes$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('all real statuses, safe reasons, long text and existing correction action', async ({ page }) => {
  await open(page);
  for (const status of ['Em análise', 'Aprovado', 'Não aprovado', 'Aguardando informações', 'Oculto', 'Removido']) await expect(page.locator('.contributions-status').filter({ hasText: status }).first()).toBeVisible();
  await expect(page.locator('.contributions-list')).not.toContainText('920e3f5b');
  await expect(page.locator('.contributions-list')).not.toContainText('Cadastro aprovado.');
  await expect(page.getByText('Local relacionado ao envio')).toBeVisible();
  const more = page.getByRole('button', { name: 'Ver mais', exact: true });
  await more.click();
  await expect(page.locator('.contributions-decision p').first()).not.toHaveClass(/truncated/);
  await expect(page.locator('.contributions-decision img')).toHaveCount(0);
  await page.getByRole('button', { name: 'Ver menos' }).click();
  await expect(page.getByRole('link', { name: 'Corrigir e reenviar' })).toHaveCount(2);
  await page.getByText('Entenda', { exact: true }).click();
  await expect(page.getByText('Fotos anexadas a cadastros ou avaliações acompanham a análise do envio. Fotos avulsas são analisadas separadamente.')).toBeVisible();
});
test('loading, request failure with retry and genuine empty state', async ({ page }) => {
  await auth(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let calls = 0;
  await page.route('**/api/me/contributions', async route => {
    if (++calls === 1) { await gate; await route.fulfill({ status: 503, json: { detail: 'Serviço indisponível.' } }); }
    else await route.fulfill({ json: [] });
  });
  await page.goto('/contribuicoes');
  await expect(page.locator('app-skeleton')).toBeVisible();
  release();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('Sua primeira contribuição começa aqui.')).toHaveCount(0);
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByText('Sua primeira contribuição começa aqui.')).toBeVisible();
  expect(calls).toBe(2);
});
test('small viewport, large fonts, both themes and navbar clearance', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await open(page);
  await page.addStyleTag({ content: 'html { font-size: 22px; }' });
  for (const theme of ['dark', 'light']) {
    await page.evaluate(value => document.documentElement.dataset['theme'] = value, theme);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
    await expect(page.locator('.contributions-top img')).toHaveAttribute('src', /assets\/brand\/khki-logo/);
    const last = page.locator('.contributions-item').last();
    await last.scrollIntoViewIfNeeded();
    const host = page.locator('app-contributions');
    await host.evaluate(element => element.scrollTop = element.scrollHeight);
    const nav = await page.locator('.mobile-bottom-nav').boundingBox();
    expect((await last.boundingBox())!.y + (await last.boundingBox())!.height).toBeLessThanOrEqual(nav!.y);
  }
  await page.screenshot({ path: '../test-results/contributions-small.png' });
});
test('desktop keeps its original presentation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 950 });
  await auth(page);
  await page.route('**/api/me/contributions', route => route.fulfill({ json: rows }));
  await page.goto('/contribuicoes');
  await expect(page.locator('.contribution-row')).toHaveCount(7);
  await expect(page.locator('app-mobile-contributions')).toHaveCount(0);
  await expect(page.locator('.page-title').getByRole('link', { name: 'Cadastrar banheiro' })).toBeVisible();
});

test('visitor must authenticate before seeing contributions', async ({ page }) => {
  await page.route('**/api/auth/csrf', route => route.fulfill({ json: {} }));
  await page.route('**/api/auth/me', route => route.fulfill({ status: 401, json: {} }));
  let requests = 0;
  await page.route('**/api/me/contributions', route => { requests++; return route.fulfill({ json: rows }); });
  await page.goto('/contribuicoes');
  await expect(page.locator('.login-backdrop')).toBeVisible();
  await expect(page.locator('.contributions-item')).toHaveCount(0);
  expect(requests).toBe(0);
});
