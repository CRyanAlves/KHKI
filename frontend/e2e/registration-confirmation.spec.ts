import { expect, test } from '@playwright/test';

for (const viewport of [{ width: 393, height: 852 }, { width: 1440, height: 950 }]) {
  test(`registration confirms discard inside the application at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.route('**/api/auth/csrf', route => route.fulfill({ json: {} }));
    await page.route('**/api/auth/me', route => route.fulfill({ json: { id: 'test', name: 'Pessoa Teste', role: 'USER' } }));
    let nativeDialogs = 0;
    page.on('dialog', async dialog => { nativeDialogs++; await dialog.dismiss(); });
    await page.goto('/cadastrar');
    const name = page.getByLabel('Nome do estabelecimento ou espaço', { exact: false });
    await name.fill('Rascunho preservado');
    const cancel = page.getByRole('button', { name: 'Cancelar', exact: true });
    await cancel.click();
    const confirmation = page.getByRole('alertdialog', { name: 'Descartar cadastro?' });
    await expect(confirmation).toBeVisible();
    await expect(confirmation.getByRole('button', { name: 'Continuar preenchendo' })).toBeFocused();
    await confirmation.getByRole('button', { name: 'Continuar preenchendo' }).click();
    await expect(confirmation).toHaveCount(0);
    await expect(name).toHaveValue('Rascunho preservado');
    await expect(page).toHaveURL(/\/cadastrar$/);
    await cancel.click();
    await page.keyboard.press('Escape');
    await expect(confirmation).toHaveCount(0);
    await expect(name).toHaveValue('Rascunho preservado');
    await cancel.click();
    await confirmation.getByRole('button', { name: 'Fechar confirmação' }).click();
    await expect(confirmation).toHaveCount(0);
    await expect(name).toHaveValue('Rascunho preservado');
    await cancel.click();
    await page.mouse.click(5, 5);
    await expect(confirmation).toHaveCount(0);
    await expect(name).toHaveValue('Rascunho preservado');
    await cancel.click();
    await page.screenshot({ path: `../test-results/registration-discard-${viewport.width}.png` });
    await confirmation.getByRole('button', { name: 'Descartar e sair' }).click();
    await expect(page).toHaveURL('http://127.0.0.1:4200/');
    await expect(confirmation).toHaveCount(0);
    expect(nativeDialogs).toBe(0);
  });
}
