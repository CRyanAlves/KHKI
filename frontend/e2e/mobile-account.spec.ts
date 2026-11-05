import { expect, Page, test } from '@playwright/test';

test.use({ viewport: { width: 393, height: 852 }, hasTouch: true });

async function prepare(page: Page, authenticated = false): Promise<void> {
  await page.route('**/api/auth/csrf', (route) => route.fulfill({ json: {} }));
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: authenticated ? 200 : 401, json: authenticated ? { id: 'account-test', name: 'Pessoa de Teste', role: 'USER' } : {} }));
  await page.goto('/');
}

test('visitor popover anchors to avatar and all closing controls preserve exploration', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('khki-theme', 'dark'));
  await prepare(page);
  const trigger = page.locator('.mobile-search-account');
  const sheet = await page.locator('.map-workspace').getAttribute('class');
  const canvas = await page.locator('.maplibregl-canvas').elementHandle();
  for (const closing of ['avatar', 'escape', 'outside', 'close']) {
    await trigger.click();
    const panel = page.getByRole('dialog', { name: 'Sua conta' });
    await expect(panel).toBeVisible();
    await expect(page.locator('#mobile-account-title')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(panel.getByRole('button', { name: 'Aparência', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(panel.getByRole('button', { name: 'Fechar conta' })).toBeFocused();
    const anchor = (await trigger.boundingBox())!;
    const box = (await panel.boundingBox())!;
    expect(Math.abs(box.y - anchor.y - anchor.height - 12)).toBeLessThan(2);
    expect(box.x).toBeGreaterThanOrEqual(16);
    expect(box.x + box.width).toBeLessThanOrEqual(377);
    await expect(panel.getByText('Faça parte do KHKI')).toBeVisible();
    await expect(panel.getByRole('link')).toHaveCount(0);
    await expect(panel.getByRole('radio')).toHaveCount(0);
    if (closing === 'avatar') {
      await page.screenshot({ path: '../test-results/account-popover-dark.png' });
      await trigger.click();
    } else if (closing === 'escape') await page.keyboard.press('Escape');
    else if (closing === 'outside') await page.mouse.click(10, 700);
    else await panel.getByRole('button', { name: 'Fechar conta' }).click();
    await expect(panel).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(page.locator('.map-workspace')).toHaveAttribute('class', sheet!);
    expect(await canvas!.evaluate((element) => element === document.querySelector('.maplibregl-canvas'))).toBe(true);
  }
});

test('appearance stays inside the popover, persists and follows system preference', async ({ page }) => {
  await prepare(page);
  await page.locator('.mobile-search-account').click();
  await page.getByRole('button', { name: 'Aparência', exact: true }).click();
  for (const [label, value] of [
    ['Claro', 'light'],
    ['Escuro', 'dark'],
    ['Sistema', 'system']
  ]) {
    await page.getByRole('radio', { name: label, exact: true }).check();
    await expect(page.getByRole('radio', { name: label, exact: true })).toBeChecked();
    expect(await page.evaluate(() => localStorage.getItem('khki-theme'))).toBe(value === 'system' ? null : value);
    await expect(page.getByRole('dialog')).toHaveCount(1);
  }
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Voltar para sua conta' }).click();
  await expect(page.getByRole('heading', { name: 'Sua conta' })).toBeVisible();
  await page.getByRole('button', { name: 'Entrar ou criar conta', exact: true }).click();
  await expect(page.locator('#mobile-account-popover')).toHaveCount(0);
  await expect(page.locator('.login-backdrop')).toBeVisible();
});

test('authenticated identity, contributions and logout use existing services', async ({ page }) => {
  await prepare(page, true);
  await page.locator('.mobile-search-account').click();
  const panel = page.getByRole('dialog');
  await expect(panel.getByText('Pessoa de Teste')).toBeVisible();
  await expect(panel.locator('.account-initials')).toHaveText('PT');
  await expect(panel.getByText('Conta conectada')).toBeVisible();
  await expect(panel.getByRole('link', { name: 'Minhas contribuições' })).toHaveAttribute('href', '/contribuicoes');
  await page.route('**/api/me/contributions', (route) => route.fulfill({ json: [] }));
  await panel.getByRole('link', { name: 'Minhas contribuições' }).click();
  await expect(page).toHaveURL(/\/contribuicoes$/);
  await page.locator('.mobile-account-shortcut').click();
  await expect(page.getByRole('dialog', { name: 'Sua conta' })).toBeVisible();
  await page.route('**/api/auth/logout', (route) => route.fulfill({ json: {} }));
  const logout = page.waitForRequest('**/api/auth/logout');
  await panel.getByRole('button', { name: 'Sair', exact: true }).click();
  await logout;
  await page.locator('.mobile-search-account').click();
  await expect(page.getByText('Faça parte do KHKI')).toBeVisible();
});

test('short screen, enlarged text and reduced motion keep close accessible', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 360 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await prepare(page);
  await page.addStyleTag({ content: 'html { font-size: 22px; }' });
  await page.locator('.mobile-search-account').click();
  const panel = page.getByRole('dialog');
  await expect(panel).toHaveCSS('animation-name', 'none');
  await expect(panel.getByRole('button', { name: 'Fechar conta' })).toBeInViewport();
  const box = (await panel.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(344);
  await expect(panel.locator('.account-panel-content')).toHaveCSS('overflow-y', 'auto');
  await page.screenshot({ path: '../test-results/account-small.png' });
});

test('desktop keeps the existing header and has no mobile account', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 950 });
  await prepare(page);
  await expect(page.locator('.site-header')).toBeVisible();
  await expect(page.locator('.mobile-search-account')).toBeHidden();
  await expect(page.locator('app-mobile-account')).toHaveCount(0);
});

test('registration and contributions keep initials circular and the account anchored', async ({ page }) => {
  await prepare(page, true);
  await page.route('**/api/me/contributions', (route) => route.fulfill({ json: [] }));
  for (const path of ['/cadastrar', '/contribuicoes']) {
    await page.goto(path);
    if (path === '/cadastrar') {
      await expect(page.locator('.map-workspace')).toHaveClass(/mobile-sheet-full/);
      await page.getByRole('button', { name: 'Recolher painel', exact: true }).click();
    }
    const trigger = page.locator('.mobile-account-shortcut');
    await expect(trigger).toBeVisible();
    await expect(trigger.locator('.account-initials')).toHaveText('PT');
    const button = (await trigger.boundingBox())!;
    const initials = (await trigger.locator('.account-initials').boundingBox())!;
    expect(button.width).toBe(44);
    expect(button.height).toBe(44);
    expect(initials.width).toBeCloseTo(initials.height, 0);
    expect(initials.width).toBeCloseTo(button.width, 0);
    expect(initials.x).toBeCloseTo(button.x, 0);
    expect(initials.y).toBeCloseTo(button.y, 0);
    await trigger.click();
    const panel = page.getByRole('dialog', { name: 'Sua conta' });
    await expect(panel).toBeVisible();
    await expect.poll(async () => (await panel.boundingBox())!.y).toBeCloseTo(button.y + button.height + 12, 0);
    await panel.getByRole('button', { name: 'Fechar conta' }).click();
  }
});
