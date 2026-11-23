import { expect, Page, test } from '@playwright/test';
import { filterUserContributions } from '../src/app/features/user/contributions/service/user-contributions-filtering';
import { canModerateContent, createModerationQueueRows, filterModerationQueue } from '../src/app/features/moderation/service/moderation-queue-filtering';
import { registrationFeeError, registrationLocationErrors, registrationVisitDateError } from '../src/app/features/bathroom/register/service/bathroom-registration-validation';
import type { Bathroom, BathroomInput } from '../src/app/domain/bathrooms/bathroom.model';
import type { Contribution } from '../src/app/domain/moderation/moderation.model';
import type { ModerationQueueItem } from '../src/app/features/moderation/model/moderation-queue.model';

const id = 'd7d0c91b-19c7-4c51-b576-395021df6b32';
const bathroom: Bathroom = { id, name: 'Café Revisão', address: 'Indaiatuba', category: 'Cafeteria', latitude: -23.1, longitude: -47.2, access: 'FREE', accessDetails: null, hours: null, accessible: true, items: [], rating: null, reviewCount: 0, photoIds: [], demo: false };
const contribution: Contribution = { id, bathroomId: id, type: 'BATHROOM', title: 'Cadastro: Café Revisão', status: 'PENDING', reason: null, createdAt: '2026-11-20T12:00:00Z' };

async function prepare(page: Page, role: 'USER' | 'ADMIN' = 'USER'): Promise<void> {
  await page.route('**/config.js', (route) => route.fulfill({ contentType: 'application/javascript', body: 'window.KHKI_CONFIG={geoapifyApiKey:"test",devRouteSimulation:false};' }));
  await page.route('https://maps.geoapify.com/**', (route) => route.fulfill({ json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#173b45' } }] } }));
  await page.route('**/api/auth/csrf', (route) => route.fulfill({ json: {} }));
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: { id: 'test', name: 'Pessoa Teste', role } }));
}

test('Preserva os dados originais ao filtrar contribuições e remove identificadores internos da apresentação', () => {
  const items: Contribution[] = [
    { ...contribution, title: 'Avaliação: Café ' + id, type: 'REVIEW', status: 'REJECTED', reason: 'Verifique ' + id + ' .', createdAt: '2026-11-19T12:00:00Z' },
    { ...contribution, id: 'approved', status: 'APPROVED', reason: 'Cadastro aprovado.' }
  ];
  const before = JSON.stringify(items);
  const rows = filterUserContributions(items, '', '', 'oldest');
  expect(rows.map((row) => row.id)).toEqual([id, 'approved']);
  expect(rows[0]).toMatchObject({ name: 'Café', decision: 'Verifique.', label: 'Não aprovado' });
  expect(rows[1].decision).toBe('');
  expect(filterUserContributions(items, 'REVIEW', 'REJECTED', 'newest')).toHaveLength(1);
  expect(JSON.stringify(items)).toBe(before);
});

test('Busca na fila de moderação com acentos e preserva as restrições de transição de estado', () => {
  const item: ModerationQueueItem = { contribution, author: 'João', address: 'Indaiatuba', complement: null, category: 'Cafeteria', thumbnailId: null, version: 7 };
  const rows = createModerationQueueRows('BATHROOM', [item], []);
  expect(filterModerationQueue(rows, 'cafe', 'newest')).toHaveLength(1);
  expect(filterModerationQueue(rows, 'JOAO', 'oldest')).toHaveLength(1);
  expect(createModerationQueueRows('REVIEW', [item], [])).toHaveLength(0);
  expect(canModerateContent('APPROVED', 'PENDING')).toBe(true);
  expect(canModerateContent('APPROVED', 'REJECTED')).toBe(false);
  expect(canModerateContent('APPROVED', 'HIDDEN')).toBe(true);
  expect(canModerateContent('HIDDEN', 'PENDING')).toBe(false);
  expect(canModerateContent('REMOVED', undefined)).toBe(false);
});

test('Preserva as validações de coordenadas, endereço alterado, valor e data no cadastro', () => {
  const input: BathroomInput = { ...bathroom, complement: bathroom.complement || '', accessDetails: '', hours: '' };
  expect(registrationLocationErrors(input, { lat: -23.1, lng: -47.2 }, false)).toEqual({});
  expect(registrationLocationErrors(input, { lat: -23.1, lng: -47.2 }, true)['location']).toContain('O endereço mudou');
  expect(registrationLocationErrors({ ...input, latitude: 999 }, { lat: 999, lng: 0 }, false)['location']).toContain('ponto válido');
  expect(registrationFeeError(null)).toBe('');
  expect(registrationFeeError(5.25)).toBe('');
  for (const amount of [0, -1, 0.001, Number.NaN, 1000000]) expect(registrationFeeError(amount)).not.toBe('');
  expect(registrationVisitDateError('2026-11-20', '2026-11-21')).toBe('');
  expect(registrationVisitDateError('2026-11-22', '2026-11-21')).not.toBe('');
});

test('Bloqueia denúncias duplicadas, preserva o motivo em falhas e permite nova tentativa', async ({ page }) => {
  await prepare(page);
  await page.route(/\/api\/bathrooms(?:\?.*)?$/, (route) => route.fulfill({ json: [bathroom] }));
  await page.route('**/api/bathrooms/' + id, (route) => route.fulfill({ json: bathroom }));
  await page.route('**/api/bathrooms/' + id + '/reviews', (route) => route.fulfill({ json: [] }));
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  let calls = 0;
  const bodies: unknown[] = [];
  await page.route('**/api/reports', async (route) => {
    calls++;
    bodies.push(route.request().postDataJSON());
    if (calls === 1) {
      await gate;
      await route.fulfill({ status: 503, json: {} });
    } else await route.fulfill({ status: 201, json: {} });
  });
  await page.goto('/banheiros/' + id);
  await page.getByRole('button', { name: 'Denunciar informações deste local', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Denunciar conteúdo' });
  await dialog.getByRole('combobox', { name: 'Motivo', exact: true }).selectOption('PRIVACY');
  const submit = dialog.getByRole('button', { name: 'Enviar denúncia', exact: true });
  await submit.click();
  await expect(dialog.getByRole('button', { name: 'Enviando…', exact: true })).toBeDisabled();
  await expect.poll(() => calls).toBe(1);
  await dialog.evaluate((form) => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(calls).toBe(1);
  release();
  await expect(submit).toBeEnabled();
  await expect(dialog.getByRole('combobox', { name: 'Motivo', exact: true })).toHaveValue('PRIVACY');
  await submit.click();
  await expect(dialog.getByRole('button', { name: 'Denúncia recebida', exact: true })).toBeDisabled();
  expect(calls).toBe(2);
  expect(bodies).toEqual([
    { targetType: 'BATHROOM', targetId: id, reason: 'PRIVACY' },
    { targetType: 'BATHROOM', targetId: id, reason: 'PRIVACY' }
  ]);
});

test('Preserva alvo, versão e motivo na consulta e decisão de moderação pelo serviço do fluxo', async ({ page }) => {
  await prepare(page, 'ADMIN');
  let approved = false;
  let decision: unknown = null;
  const item: ModerationQueueItem = { contribution, author: 'Pessoa Teste', address: 'Indaiatuba', complement: null, category: 'Cafeteria', thumbnailId: null, version: 7 };
  await page.route('**/api/admin/queue/details?**', (route) => route.fulfill({ json: approved ? [] : [item] }));
  await page.route('**/api/admin/reports?**', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/admin/content/BATHROOM/' + id, (route) => route.fulfill({ json: { contribution: { ...contribution, status: approved ? 'APPROVED' : 'PENDING' }, content: bathroom, author: 'Pessoa Teste', version: approved ? 8 : 7, bathroom, photos: [] } }));
  await page.route('**/api/admin/content/BATHROOM/' + id + '/history', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/admin/bathrooms/' + id + '/nearby', (route) => route.fulfill({ json: { radiusMeters: 100, candidates: [] } }));
  await page.route('**/api/admin/content/BATHROOM/' + id + '/decision', (route) => {
    decision = route.request().postDataJSON();
    approved = true;
    return route.fulfill({ json: {} });
  });
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Analisar ' + contribution.title, exact: true }).click();
  await page.getByRole('textbox', { name: 'Motivo da decisão ou encerramento *', exact: true }).fill('Cadastro conferido.');
  await page.getByRole('button', { name: 'Aprovar cadastro', exact: true }).click();
  await page.getByRole('dialog', { name: 'Confirmar aprovação', exact: true }).getByRole('button', { name: 'Confirmar aprovação', exact: true }).click();
  await expect(page.getByText('Decisão registrada com responsável, data e motivo.', { exact: true })).toBeVisible();
  expect(decision).toEqual({ status: 'APPROVED', reason: 'Cadastro conferido.', expectedVersion: 7, duplicateOfId: null });
});

test('Preserva o marcador selecionado nos detalhes por link direto quando a consulta de avaliações falha', async ({ page }) => {
  await prepare(page);
  await page.route(/\/api\/bathrooms(?:\?.*)?$/, (route) => route.fulfill({ json: [] }));
  await page.route('**/api/bathrooms/' + id, (route) => route.fulfill({ json: bathroom }));
  await page.route('**/api/bathrooms/' + id + '/reviews', (route) => route.fulfill({ status: 503, json: {} }));
  await page.goto('/banheiros/' + id);
  await expect(page.locator('.details-panel')).toContainText('Não foi possível concluir. Tente novamente.');
  await expect(page.locator('.map-marker.is-selected')).toHaveCount(1);
  await expect(page.locator('.map-marker.is-selected')).toHaveAttribute('data-bathroom-id', id);
});
