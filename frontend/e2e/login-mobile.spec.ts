import { expect, Page, test } from '@playwright/test';

test.use({ viewport: { width: 393, height: 852 }, hasTouch: true });

async function openLogin(page: Page): Promise<void> {
  await page.goto('/');
  await page.locator('.mobile-search-account').click();
  await page.getByRole('button', { name: 'Entrar ou criar conta', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

async function resizeVisualViewport(page: Page, height: number, top = 0): Promise<void> {
  await page.evaluate(({ height, top }) => {
    Object.defineProperty(window.visualViewport!, 'height', { configurable: true, get: () => height });
    Object.defineProperty(window.visualViewport!, 'offsetTop', { configurable: true, get: () => top });
    window.visualViewport!.dispatchEvent(new Event('resize'));
  }, { height, top });
}

test('mobile login fills the viewport, uses official assets and restores exploration on close', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('khki-theme', 'dark'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Expandir painel', exact: true }).click();
  const sheet = await page.locator('.map-workspace').getAttribute('class');
  const map = await page.locator('.maplibregl-canvas').elementHandle();
  await page.locator('.mobile-search-account').click();
  await page.getByRole('button', { name: 'Entrar ou criar conta', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  expect(await dialog.boundingBox()).toMatchObject({ x: 0, y: 0, width: 393, height: 852 });
  await expect(page.locator('.login-brand')).toHaveAttribute('src', 'assets/brand/khki-logo-dark.png');
  await expect(page.locator('.city-illustration')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Fechar', exact: true })).toBeFocused();
  await expect(dialog.getByText('Cadastre banheiros, avalie e ajude quem vem depois.')).toBeVisible();
  await page.screenshot({ path: '../test-results/login-mobile-dark.png' });
  await dialog.getByRole('button', { name: 'Continuar explorando sem entrar', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.map-workspace')).toHaveAttribute('class', sheet!);
  expect(await map!.evaluate(element => element === document.querySelector('.maplibregl-canvas'))).toBe(true);
});

test('viewport reduction compacts login, preserves values between fields and restores the illustration', async ({ page }) => {
  await openLogin(page);
  await page.getByLabel('E-mail', { exact: true }).fill('pessoa@example.com');
  await expect(page.locator('.city-illustration')).toBeVisible();
  await page.getByLabel('E-mail', { exact: true }).press('Enter');
  await expect(page.getByLabel('Senha', { exact: true })).toBeFocused();
  await page.getByLabel('Senha', { exact: true }).fill('senha-para-teste');
  await resizeVisualViewport(page, 510, 20);
  await expect(page.locator('.login-backdrop')).toHaveClass(/login-compact/);
  await expect(page.locator('.city-illustration')).toBeHidden();
  await expect(page.locator('.login-mobile-support').first()).toBeHidden();
  expect(await page.getByRole('dialog').boundingBox()).toMatchObject({ y: 20, height: 510 });
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Entrar', exact: true })).toBeInViewport();
  await page.getByLabel('E-mail', { exact: true }).focus();
  await expect(page.locator('.login-backdrop')).toHaveClass(/login-compact/);
  await expect(page.getByLabel('Senha', { exact: true })).toHaveValue('senha-para-teste');
  await page.getByRole('button', { name: 'Mostrar ou ocultar senha' }).click();
  await expect(page.getByLabel('Senha', { exact: true })).toHaveAttribute('type', 'text');
  await expect(page.getByLabel('Senha', { exact: true })).toHaveValue('senha-para-teste');
  await page.screenshot({ path: '../test-results/login-mobile-keyboard-viewport.png' });
  await resizeVisualViewport(page, 852);
  await expect(page.locator('.login-backdrop')).not.toHaveClass(/login-compact/);
  await expect(page.locator('.city-illustration')).toBeVisible();
  await expect(page.getByLabel('E-mail', { exact: true })).toHaveValue('pessoa@example.com');
});

test('inline validation and delayed authentication reject duplicate submits and preserve errors', async ({ page }) => {
  let calls = 0;
  let respond!: () => void;
  const pending = new Promise<void>(resolve => { respond = resolve; });
  await page.route('**/api/auth/login', async route => {
    calls++;
    await pending;
    await route.fulfill({ status: 401, json: { detail: 'E-mail ou senha inválidos.' } });
  });
  await openLogin(page);
  const form = page.locator('.login-form');
  await form.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByText('Informe seu e-mail.', { exact: true })).toBeVisible();
  await expect(page.getByText('Informe sua senha.', { exact: true })).toBeVisible();
  expect(calls).toBe(0);
  await page.getByLabel('E-mail', { exact: true }).fill('endereco-invalido');
  await page.getByLabel('E-mail', { exact: true }).blur();
  await expect(page.getByText('Informe um e-mail válido.', { exact: true })).toBeVisible();
  await page.getByLabel('E-mail', { exact: true }).fill('pessoa@example.com');
  await page.getByLabel('Senha', { exact: true }).fill('senha-invalida');
  await page.getByLabel('Senha', { exact: true }).press('Enter');
  await expect(form.getByRole('button', { name: 'Aguarde…', exact: true })).toBeDisabled();
  await form.evaluate(element => {
    element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await expect.poll(() => calls).toBe(1);
  respond();
  await expect(page.getByRole('alert')).toHaveText('E-mail ou senha inválidos.');
  await expect(page.getByLabel('E-mail', { exact: true })).toHaveValue('pessoa@example.com');
  await expect(form.getByRole('button', { name: 'Entrar', exact: true })).toBeEnabled();
});

test('authenticated response resumes the protected route and registration remains available', async ({ page }) => {
  await page.route('**/api/auth/me', route => route.fulfill({ status: 401, json: { detail: 'Entre na sua conta.' } }));
  await page.route('**/api/auth/login', route => route.fulfill({ json: { id: '11111111-1111-4111-8111-111111111111', name: 'Pessoa de teste', role: 'USER' } }));
  await openLogin(page);
  await page.getByRole('button', { name: 'Cadastre-se', exact: true }).click();
  await expect(page.getByLabel('Nome', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Senha', { exact: true })).toHaveAttribute('autocomplete', 'new-password');
  await page.getByRole('button', { name: 'Continuar explorando sem entrar', exact: true }).click();
  await page.getByRole('navigation', { name: 'Navegação mobile' }).getByRole('link', { name: 'Cadastrar', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('E-mail', { exact: true }).fill('pessoa@example.com');
  await page.getByLabel('Senha', { exact: true }).fill('senha-para-teste');
  await page.locator('.login-form').getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/cadastrar$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByLabel('Nome do estabelecimento ou espaço', { exact: false })).toBeVisible();
});

test('the real local backend rejects invalid credentials without closing the form', async ({ page }) => {
  await openLogin(page);
  await page.getByLabel('E-mail', { exact: true }).fill(`login-ui-${Date.now()}@example.invalid`);
  await page.getByLabel('Senha', { exact: true }).fill('invalid-test-password');
  const response = page.waitForResponse(result => result.url().endsWith('/api/auth/login') && result.request().method() === 'POST');
  await page.locator('.login-form').getByRole('button', { name: 'Entrar', exact: true }).click();
  expect((await response).status()).toBe(401);
  await expect(page.getByRole('alert')).toHaveText('E-mail ou senha inválidos.');
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('small screens, enlarged fonts, landscape and desktop keep the form usable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openLogin(page);
  await expect(page.locator('.login-brand')).toHaveAttribute('src', 'assets/brand/khki-logo.png');
  await page.evaluate(() => { document.documentElement.style.fontSize = '20px'; });
  const submit = page.locator('.login-form').getByRole('button', { name: 'Entrar', exact: true });
  await submit.scrollIntoViewIfNeeded();
  await expect(submit).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 600, height: 360 });
  await submit.scrollIntoViewIfNeeded();
  await expect(submit).toBeInViewport();
  await page.evaluate(() => { document.documentElement.style.removeProperty('font-size'); });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator('.login-brand')).toBeHidden();
  await expect(page.locator('.login-continue')).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Que bom ter você aqui', exact: true })).toBeVisible();
  const bounds = await page.getByRole('dialog').boundingBox();
  expect(bounds!.width).toBe(900);
  expect(bounds!.x).toBe(270);
  await page.screenshot({ path: '../test-results/login-desktop-preserved.png' });
});
