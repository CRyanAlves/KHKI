import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.route('**/config.js', route => route.fulfill({ contentType: 'application/javascript', body: "window.KHKI_CONFIG = { geoapifyApiKey: '' };" })); });

test('theme follows system until explicit choice, persists and applies to pages and dialogs', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/sobre'); await expect(page).toHaveURL(/\/$/); await expect(page.getByRole('link', { name: 'Sobre', exact: true })).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.brand-tagline')).toHaveCount(0);
  const logo = await page.locator('.brand').boundingBox(); const navigation = await page.getByRole('navigation', { name: 'Navegação principal' }).boundingBox(); const actions = await page.locator('.header-actions').boundingBox();
  expect(navigation!.x).toBeGreaterThan(logo!.x + logo!.width); expect(navigation!.x - logo!.x - logo!.width).toBeLessThan(40); expect(actions!.x).toBeGreaterThan(navigation!.x + navigation!.width);
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(13, 23, 28)');
  await expect(page.locator('.workspace-panel')).toHaveCSS('background-color', 'rgb(13, 23, 28)');
  await expect(page.locator('.bathroom-card').first()).toHaveCSS('color', 'rgb(242, 246, 247)');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const toggle = page.getByRole('button', { name: 'Ativar modo escuro', exact: true });
  await toggle.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Ativar modo claro', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.theme-toggle')).toHaveClass(/is-dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => localStorage.getItem('khki-theme'))).toBe('dark');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCSS('background-color', 'rgb(21, 39, 47)');
  await page.screenshot({ path: '../test-results/theme-dark-login.png', fullPage: true });
  await page.keyboard.press('Escape');
  await page.locator('.bathroom-card').first().click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Ativar modo claro', exact: true }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('theme toggle remains visible on mobile with no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Ativar modo escuro', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ativar modo claro', exact: true })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeInViewport();
  await page.getByRole('button', { name: 'Abrir navegação', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Cadastrar banheiro', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Abrir navegação', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '../test-results/theme-dark-mobile.png', fullPage: true });
});

test('unavailable storage still allows theme switching', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(() => { Object.defineProperty(Storage.prototype, 'getItem', { value: () => { throw new Error('Storage blocked'); } }); Object.defineProperty(Storage.prototype, 'setItem', { value: () => { throw new Error('Storage blocked'); } }); });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Ativar modo claro', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});


test('header tabs have readable selected and hover states in both themes and respect reduced motion', async ({ page }) => {
  const contrast = (foreground: string, background: string) => {
    const luminance = (color: string) => { const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(value => { const channel = Number(value) / 255; return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4); }); return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722; };
    const first = luminance(foreground); const second = luminance(background); return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  };
  await page.goto('/');
  for (const theme of ['light', 'dark'] as const) {
    if (await page.locator('html').getAttribute('data-theme') !== theme) await page.locator('.theme-toggle').click();
    const tabs = page.locator('.main-nav > a'); await expect(tabs).toHaveCount(2);
    const selected = page.getByRole('link', { name: 'Explorar', exact: true });
    await expect(selected).toHaveAttribute('aria-current', 'page');
    await expect(selected.locator('app-icon')).toBeVisible();
    await expect.poll(async () => { const colors = await selected.evaluate(element => ({ text: getComputedStyle(element).color, background: getComputedStyle(element, '::before').backgroundColor })); return contrast(colors.text, colors.background); }).toBeGreaterThanOrEqual(4.5);
    const registration = page.getByRole('link', { name: 'Cadastrar banheiro', exact: true }); await registration.hover();
    await expect.poll(() => registration.evaluate(element => getComputedStyle(element, '::before').opacity)).toBe('1');
    const hoverColors = await registration.evaluate(element => ({ text: getComputedStyle(element).color, background: getComputedStyle(element, '::before').backgroundColor })); expect(contrast(hoverColors.text, hoverColors.background)).toBeGreaterThanOrEqual(4.5);
    await page.locator('.site-header').screenshot({ path: '../test-results/header-tabs-' + theme + '.png' });
  }
  await page.locator('.bathroom-card').first().click();
  await expect(page.getByRole('link', { name: 'Explorar', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('link', { name: 'Explorar', exact: true })).toHaveClass(/active/);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.getByRole('link', { name: 'Cadastrar banheiro', exact: true }).evaluate(element => parseFloat(getComputedStyle(element, '::before').transitionDuration))).toBeLessThanOrEqual(0.001);
});

test('sidebar slides, rotates the same icon and preserves its content on desktop and mobile', async ({ page }) => {
  await page.goto('/');
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const panel = page.locator('.workspace-panel'); const toggle = page.locator('.panel-toggle'); const icon = await toggle.locator('svg').elementHandle(); const content = await panel.locator('app-explore').elementHandle(); const map = await page.locator('app-map').elementHandle();
    const before = await panel.boundingBox(); const mapBefore = await page.locator('.workspace-map').boundingBox(); const iconBefore = await toggle.locator('app-icon').evaluate(element => getComputedStyle(element).transform);
    await toggle.click(); await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const midpoint = await panel.evaluate(element => {
      const animation = element.getAnimations().find(animation => (animation as CSSTransition).transitionProperty === 'transform');
      if (!animation) throw new Error('A sidebar não iniciou a animação de recolhimento.');
      animation.pause(); animation.currentTime = Number(animation.effect!.getTiming().duration) / 2;
      const transform = new DOMMatrixReadOnly(getComputedStyle(element).transform); const offset = { x: transform.m41, y: transform.m42 };
      animation.play(); return offset;
    });
    if (width > 640) { expect(midpoint.x).toBeLessThan(0); expect(midpoint.x).toBeGreaterThan(-before!.width); } else { expect(midpoint.y).toBeGreaterThan(0); expect(midpoint.y).toBeLessThan(before!.height); }
    await expect(panel).toBeHidden(); expect(await panel.evaluate(element => element.inert)).toBe(true);
    expect(await icon!.evaluate(element => element === document.querySelector('.panel-toggle svg'))).toBe(true);
    expect(await toggle.locator('app-icon').evaluate(element => getComputedStyle(element).transform)).not.toBe(iconBefore);
    expect(await page.locator('.workspace-map').boundingBox()).toEqual(mapBefore);
    await toggle.click(); await expect(toggle).toHaveAttribute('aria-expanded', 'true'); await expect(panel).toBeVisible();
    await expect.poll(() => panel.evaluate(element => { const transform = new DOMMatrixReadOnly(getComputedStyle(element).transform); return Math.abs(transform.m41) + Math.abs(transform.m42); })).toBe(0);
    expect(await content!.evaluate(element => element === document.querySelector('app-explore'))).toBe(true); expect(await map!.evaluate(element => element === document.querySelector('app-map'))).toBe(true);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.locator('.panel-toggle').click(); await expect(page.locator('.workspace-panel')).toBeHidden();
  expect(await page.locator('.workspace-panel').evaluate(element => parseFloat(getComputedStyle(element).transitionDuration))).toBeLessThanOrEqual(0.001);
});