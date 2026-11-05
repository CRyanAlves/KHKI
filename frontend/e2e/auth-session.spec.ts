import { expect, Page, test } from '@playwright/test';

const user = { id: 'session-test', name: 'Pessoa Teste', role: 'USER' };
async function prepare(page: Page): Promise<void> {
  await page.route('**/config.js', (route) => route.fulfill({ contentType: 'application/javascript', body: 'window.KHKI_CONFIG={geoapifyApiKey:"test",devRouteSimulation:false};' }));
  await page.route('https://maps.geoapify.com/**', (route) => route.fulfill({ json: { version: 8, sources: {}, layers: [] } }));
  await page.route('**/api/**', (route) => route.fulfill({ json: route.request().url().endsWith('/auth/csrf') ? { token: 'test-csrf' } : [] }));
}
async function enter(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill('pessoa@example.test');
  await page.locator('#login-password').fill('Test-password-123');
}

test('temporary startup failure retries the saved session and resumes the protected action without login', async ({ page }) => {
  await prepare(page);
  let available = false;
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: available ? 200 : 503, json: available ? user : { detail: 'Indisponível' } }));
  await page.goto('/');
  await expect(page.locator('.session-notice')).toContainText('Não foi possível verificar');
  await page.getByRole('link', { name: 'Cadastrar banheiro', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  available = true;
  await page.locator('.session-notice').getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page).toHaveURL(/\/cadastrar$/);
  await expect(page.getByRole('button', { name: 'Sair da conta' })).toContainText(user.name);
  await expect(page.locator('.session-notice')).toHaveCount(0);
});

test('401 means visitor while an offline session check offers retry and recovers online', async ({ page }) => {
  await prepare(page);
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401, json: {} }));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
  await expect(page.locator('.session-notice')).toHaveCount(0);
  await page.route('**/api/auth/me', (route) => route.abort('internetdisconnected'));
  await page.reload();
  await expect(page.locator('.session-notice')).toBeVisible();
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: user }));
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByRole('button', { name: 'Sair da conta' })).toContainText(user.name);
  await expect(page.locator('.session-notice')).toHaveCount(0);
});

test('remember option is sent only by explicit choice and login retains its contextual destination', async ({ page }) => {
  await prepare(page);
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401, json: {} }));
  let payload: Record<string, unknown> = {};
  await page.route('**/api/auth/login', (route) => {
    payload = route.request().postDataJSON();
    return route.fulfill({ json: user });
  });
  await page.goto('/');
  await page.getByRole('link', { name: 'Cadastrar banheiro', exact: true }).click();
  await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill('pessoa@example.test');
  await page.locator('#login-password').fill('Test-password-123');
  const remember = page.getByRole('checkbox', { name: 'Manter conectado neste dispositivo' });
  await expect(remember).not.toBeChecked();
  await remember.check();
  await page.getByRole('dialog').getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/cadastrar$/);
  expect(payload['rememberMe']).toBe(true);
});

test('failed login does not pretend the session expired and late startup responses cannot undo a successful login', async ({ page }) => {
  await prepare(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/auth/me', async (route) => {
    await gate;
    await route.fulfill({ status: 401, json: {} });
  });
  await page.route('**/api/auth/login', (route) => route.fulfill({ status: 401, json: { detail: 'E-mail ou senha inválidos.' } }));
  await page.goto('/');
  await enter(page);
  await page.getByRole('dialog').getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('E-mail ou senha inválidos.');
  await expect(page.locator('.session-notice')).toHaveCount(0);
  await page.route('**/api/auth/login', (route) => route.fulfill({ json: user }));
  await page.getByRole('dialog').getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  release();
  await expect(page.getByRole('button', { name: 'Sair da conta' })).toContainText(user.name);
  await expect(page.locator('.session-notice')).toHaveCount(0);
});

test('server and permission errors preserve the account; protected 401 expires it', async ({ page }) => {
  await prepare(page);
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: user }));
  await page.route('**/api/me/contributions', (route) => route.fulfill({ status: 503, json: { detail: 'Serviço indisponível.' } }));
  await page.goto('/contribuicoes');
  await expect(page.getByText('Serviço indisponível.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sair da conta' })).toContainText(user.name);
  await page.route('**/api/me/contributions', (route) => route.fulfill({ status: 403, json: { detail: 'Sem permissão.' } }));
  await page.reload();
  await expect(page.getByText('Sem permissão.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sair da conta' })).toContainText(user.name);
  await page.route('**/api/me/contributions', (route) => route.fulfill({ status: 401, json: { detail: 'Sessão expirada.' } }));
  await page.reload();
  await expect(page.locator('.session-notice')).toContainText('Sua sessão expirou');
  await expect(page.getByRole('button', { name: 'Sair da conta' })).toHaveCount(0);
});

test('invalid account responses are treated as unavailable without breaking the account menu', async ({ page }) => {
  await prepare(page);
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: { id: 'incomplete' } }));
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/');
  await expect(page.locator('.session-notice')).toContainText('Não foi possível verificar');
  await page.getByRole('button', { name: 'Abrir sua conta' }).click();
  await expect(page.getByRole('button', { name: 'Entrar ou criar conta', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
