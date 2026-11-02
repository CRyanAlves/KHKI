import { expect, Page, test } from '@playwright/test';
import { formatRouteDuration, parseManeuvers, upcomingDirections } from '../src/app/core/route-guidance';

test('route duration formats minute and hour boundaries without showing 60 remaining minutes', () => {
  for (const [minutes, text] of [
    [1, '1 min'],
    [59, '59 min'],
    [60, '1 h'],
    [61, '1 h 1 min'],
    [65, '1 h 5 min'],
    [119.5, '2 h'],
    [125, '2 h 5 min']
  ] as const)
    expect(formatRouteDuration(minutes * 60000)).toBe(text);
  for (const value of [undefined, NaN, Infinity, -1]) expect(formatRouteDuration(value)).toBe('Tempo não informado');
});

test('maneuvers use real geometry indices, separate legs and correct direction icons', () => {
  const coordinates = [
    [
      [0, 0],
      [0, 0.001],
      [0.001, 0.001]
    ],
    [
      [1, 1],
      [1, 1.001]
    ]
  ];
  const steps = parseManeuvers(
    [
      {
        steps: [
          { from_index: 0, to_index: 1, instruction: { text: 'Siga', type: 'Straight' } },
          { from_index: 1, to_index: 2, instruction: { text: 'Esquerda', type: 'Left' } }
        ]
      },
      {
        steps: [
          { from_index: 0, to_index: 1, instruction: { text: 'Direita', type: 'Right' } },
          { from_index: 1, to_index: 1, instruction: { text: 'Destino', type: 'DestinationReached' } }
        ]
      }
    ],
    coordinates
  );
  expect(steps.map((step) => step.icon)).toEqual(['ArrowUp', 'CornerUpLeft', 'CornerUpRight', 'Flag']);
  expect(steps[1].fromMeters).toBeCloseTo(111.195, 2);
  expect(steps[2].fromMeters).toBeCloseTo(222.39, 2);
  expect(steps[3].fromMeters!).toBeLessThan(335);
  expect(upcomingDirections(steps, 0).map((step) => step.text)).toEqual(['Siga', 'Esquerda']);
  expect(upcomingDirections(steps, 125).map((step) => step.text)).toEqual(['Direita', 'Destino']);
  expect(upcomingDirections(steps, 300).length).toBeLessThanOrEqual(2);
  expect(upcomingDirections(steps, 0, true)[0].icon).toBe('Flag');
});

test('invalid positioning is not guessed from instruction count and unknown types remain safe', () => {
  const steps = parseManeuvers(
    [
      {
        steps: [
          { from_index: -1, to_index: 1, instruction: { text: 'Sem posição', type: '__proto__' } },
          { from_index: 99, to_index: 100, instruction: { text: 'Outra', type: 'Right' } },
          { from_index: 0, to_index: 1, instruction: { text: '', type: 'Left' } }
        ]
      }
    ],
    [
      [
        [0, 0],
        [0, 0.001]
      ]
    ]
  );
  expect(steps).toHaveLength(2);
  expect(steps[0].icon).toBe('Navigation');
  expect(steps[0].fromMeters).toBe(null);
  expect(upcomingDirections(steps, 9999).map((step) => step.text)).toEqual(['Sem posição', 'Outra']);
});

async function prepare(page: Page, long = false): Promise<void> {
  const base = process.env['KHKI_MAPS_SIMULATION_URL'];
  test.skip(!base, 'Execute npm test para iniciar os serviços HTTP isolados.');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/config.js', (route) => route.fulfill({ contentType: 'application/javascript', body: `window.KHKI_CONFIG=${JSON.stringify({ geoapifyApiKey: 'simulation-key', geoapifyApiBaseUrl: base + '/v1', geoapifyMapsBaseUrl: base + '/v1', devRouteSimulation: true })};` }));
  if (long)
    await page.route('**/v1/routing*', (route) => {
      const url = new URL(route.request().url());
      url.searchParams.set('simulationScenario', 'long');
      return route.continue({ url: url.toString() });
    });
  await page.goto('/');
  await page.locator('.bathroom-card').first().click();
  await page.getByRole('link', { name: 'Como chegar', exact: true }).click();
  const input = page.getByRole('combobox', { name: 'Sua origem', exact: true });
  await input.fill('Rua de teste');
  await input.press('Enter');
  await expect(page.locator('.route-summary')).toBeVisible();
  await expect(page.locator('.navigation-direction')).toHaveCount(2);
}

test('hour summary and two directional cards sit in the lower left of the same map in both themes', async ({ page }) => {
  test.setTimeout(90000);
  await prepare(page, true);
  await expect(page.getByRole('heading', { name: '1 h 5 min', exact: true })).toBeVisible();
  await expect(page.locator('app-route .route-step')).toHaveCount(0);
  await expect(page.locator('.navigation-direction').nth(1)).toHaveAttribute('data-maneuver', 'Left');
  const stack = await page.locator('.navigation-map-stack').boundingBox();
  const panel = await page.locator('.workspace-panel').boundingBox();
  const map = await page.locator('.workspace-map').boundingBox();
  expect(stack!.x).toBeGreaterThanOrEqual(panel!.x + panel!.width);
  expect(map!.y + map!.height - stack!.y - stack!.height).toBeLessThan(30);
  const canvas = await page.locator('.maplibregl-canvas').elementHandle();
  await page.getByRole('button', { name: 'Ativar modo escuro', exact: true }).click();
  await expect(page.locator('.map-loading')).toHaveCount(0);
  await expect(page.locator('.navigation-direction')).toHaveCount(2);
  expect(await canvas!.evaluate((element) => element === document.querySelector('.maplibregl-canvas'))).toBe(true);
  await page.screenshot({ path: '../test-results/guidance-desktop-dark.png' });
});

test('simulated progress advances left and right instructions and arrival on mobile without calling routing again', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await prepare(page);
  let calls = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('/routing')) calls++;
  });
  await page.getByRole('button', { name: 'Simular percurso', exact: true }).click();
  await page.getByRole('button', { name: 'Pausar simulação', exact: true }).click();
  await page.getByRole('button', { name: 'Avançar 10 s', exact: true }).click();
  await expect(page.locator('.navigation-direction').first()).toHaveAttribute('data-maneuver', 'Left');
  await expect(page.locator('.navigation-direction').nth(1)).toHaveAttribute('data-maneuver', 'Right');
  await page.getByRole('button', { name: 'Avançar 10 s', exact: true }).click();
  await page.getByRole('button', { name: 'Avançar 10 s', exact: true }).click();
  await expect(page.locator('.navigation-direction').first()).toHaveAttribute('data-maneuver', 'Right');
  await expect
    .poll(async () => {
      const marker = await page.locator('.map-position.is-navigating').boundingBox();
      const card = await page.locator('.navigation-map-stack').boundingBox();
      return !!marker && !!card && marker.y + marker.height < card.y;
    })
    .toBe(true);
  await page.screenshot({ path: '../test-results/guidance-mobile-progress.png' });
  await page.getByRole('combobox', { name: 'Velocidade da simulação', exact: true }).selectOption('30');
  await page.getByRole('button', { name: 'Avançar 10 s', exact: true }).click();
  await expect(page.locator('.navigation-direction')).toHaveCount(1);
  await expect(page.locator('.navigation-direction')).toHaveAttribute('data-maneuver', 'DestinationReached');
  expect(calls).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('GPS progress updates the next maneuver, ignores backward jitter and keeps the source map', async ({ page }) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    Object.defineProperty(navigator.geolocation, 'watchPosition', {
      configurable: true,
      value: (callback: PositionCallback) => {
        (window as unknown as { guidanceFix: PositionCallback }).guidanceFix = callback;
        return 1;
      }
    });
    Object.defineProperty(navigator.geolocation, 'clearWatch', { configurable: true, value: () => {} });
  });
  await prepare(page);
  const canvas = await page.locator('.maplibregl-canvas').elementHandle();
  await page.getByRole('button', { name: 'Iniciar navegação', exact: true }).click();
  await expect(page.locator('.map-workspace')).toHaveClass(/panel-collapsed/);
  await page.getByRole('button', { name: 'Reabrir painel', exact: true }).click();
  await expect(page.locator('.map-workspace')).not.toHaveClass(/panel-collapsed/);
  const fix = async (index: number) =>
    page.locator('app-map').evaluate((element, index) => {
      const component = (window as unknown as { ng: { getComponent(element: Element): { route: { geometry: { geometry: { coordinates: number[][][] } } } } } }).ng.getComponent(element);
      const point = component.route.geometry.geometry.coordinates[0][index];
      (window as unknown as { guidanceFix: PositionCallback }).guidanceFix({ coords: { latitude: point[1], longitude: point[0], accuracy: 5, heading: 90, speed: 3 }, timestamp: Date.now() } as GeolocationPosition);
    }, index);
  await fix(0);
  await fix(2);
  await expect(page.locator('.navigation-direction').first()).toHaveAttribute('data-maneuver', 'Right');
  await fix(0);
  await expect(page.locator('.navigation-direction').first()).toHaveAttribute('data-maneuver', 'Right');
  expect(await canvas!.evaluate((element) => element === document.querySelector('.maplibregl-canvas'))).toBe(true);
  await page.locator('.navigation-hud').getByRole('button', { name: 'Encerrar navegação', exact: true }).click();
  await expect(page.locator('.map-workspace')).not.toHaveClass(/panel-collapsed/);
});
