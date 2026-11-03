import { expect, Page, test } from '@playwright/test';
import type { Map as LibreMap } from 'maplibre-gl';
import type { NavigationService } from '../src/app/core/navigation.service';
import type { TravelRoute } from '../src/app/core/maps.service';

interface MapRuntime {
  map: LibreMap;
  route: TravelRoute;
}
interface WorkspaceRuntime {
  navigation: NavigationService;
  state: { position(): unknown };
}
interface NavigationHarness {
  watches: number;
  clears: number[];
  fix: PositionCallback | null;
  failure: PositionErrorCallback | null;
  oldFix: PositionCallback | null;
  sensorPermission: 'granted' | 'denied';
  sensorRequests: number;
  gesture: boolean;
  options: PositionOptions | null;
  canvas?: HTMLCanvasElement;
  source?: unknown;
  dataUpdates: number;
  lastGeometry?: TravelRoute['geometry'];
}
declare global {
  interface Window {
    navigationHarness: NavigationHarness;
  }
}

async function configure(page: Page, enabled = true): Promise<void> {
  const simulation = process.env['KHKI_MAPS_SIMULATION_URL'];
  await page.route('**/config.js', (route) => route.fulfill({ contentType: 'application/javascript', body: `window.KHKI_CONFIG = ${JSON.stringify({ geoapifyApiKey: 'simulation-key', geoapifyApiBaseUrl: simulation + '/v1', geoapifyMapsBaseUrl: simulation + '/v1', devRouteSimulation: enabled })};` }));
}
async function prepare(page: Page, enabled = true): Promise<void> {
  await configure(page, enabled);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Expandir painel', exact: true }).click();
  await page.locator('.bathroom-card').first().click();
  await page.getByRole('link', { name: 'Como chegar', exact: true }).click();
  await page.getByRole('combobox', { name: 'Sua origem', exact: true }).fill('Rua Augusta, São Paulo');
  await page.getByRole('combobox', { name: 'Sua origem', exact: true }).press('Enter');
  await expect(page.locator('.route-summary')).toBeVisible();
  await page.waitForFunction(() => {
    const runtime = (window as unknown as { ng: { getComponent(element: Element | null): MapRuntime } }).ng.getComponent(document.querySelector('app-map'));
    return runtime.map?.isStyleLoaded() && !!runtime.map.getSource('walking-route');
  });
  await page.locator('app-map').evaluate((element) => {
    const runtime = (window as unknown as { ng: { getComponent(element: Element): MapRuntime } }).ng.getComponent(element);
    window.navigationHarness.canvas = runtime.map.getCanvas();
    window.navigationHarness.source = runtime.map.getSource('walking-route');
    const source = window.navigationHarness.source as { setData(...args: unknown[]): unknown };
    const original = source.setData.bind(source);
    source.setData = (...args) => {
      window.navigationHarness.dataUpdates++;
      window.navigationHarness.lastGeometry = args[0] as TravelRoute['geometry'];
      return original(...args);
    };
  });
}
async function fix(page: Page, fraction = 0, overrides: Partial<GeolocationCoordinates> = {}, old = false): Promise<void> {
  await page.locator('app-map').evaluate(
    (element, input) => {
      const runtime = (window as unknown as { ng: { getComponent(element: Element): MapRuntime } }).ng.getComponent(element);
      const line = runtime.route.geometry.geometry.coordinates[0];
      const from = line[0];
      const to = line[1];
      const callback = input.old ? window.navigationHarness.oldFix : window.navigationHarness.fix;
      callback?.({ coords: { latitude: from[1] + (to[1] - from[1]) * input.fraction, longitude: from[0] + (to[0] - from[0]) * input.fraction, accuracy: 10, heading: 90, speed: 3, ...input.overrides }, timestamp: Date.now() } as GeolocationPosition);
    },
    { fraction, overrides, old }
  );
}
async function camera(page: Page): Promise<{ pitch: number; bearing: number; y: number; height: number; availableHeight: number }> {
  return page.locator('app-map').evaluate((element) => {
    const component = (window as unknown as { ng: { getComponent(element: Element): MapRuntime & { navigation: { position: { lat: number; lng: number } } | null } } }).ng.getComponent(element);
    const point = component.navigation?.position;
    const height = component.map.getCanvas().clientHeight;
    const obstruction = document.querySelector('.navigation-hud')?.getBoundingClientRect().height || 0;
    return { pitch: component.map.getPitch(), bearing: component.map.getBearing(), y: point ? component.map.project([point.lng, point.lat]).y : 0, height, availableHeight: height - obstruction };
  });
}
async function deviation(page: Page, accuracy = 10): Promise<void> {
  await fix(page, 0, { latitude: -23.546, longitude: -46.658, accuracy });
}
async function confirmedDeviation(page: Page): Promise<void> {
  await deviation(page);
  await advanceGpsTime(page, 3000);
  await deviation(page);
  await advanceGpsTime(page, 3000);
  await deviation(page);
}
async function advanceGpsTime(page: Page, milliseconds: number): Promise<void> {
  await page.clock.setSystemTime(new Date((await page.evaluate(() => Date.now())) + milliseconds));
}
async function navigationStatus(page: Page): Promise<{ busy: boolean; rerouted: boolean; routeMatches: boolean; sameMap: boolean; active: boolean }> {
  return page.locator('app-map').evaluate((element) => {
    const ng = (window as unknown as { ng: { getComponent(element: Element): MapRuntime & WorkspaceRuntime & { route: TravelRoute } } }).ng;
    const runtime = ng.getComponent(element);
    const navigation = ng.getComponent(document.querySelector('app-workspace')!).navigation;
    const update = navigation.rerouted();
    return { busy: navigation.recalculating(), rerouted: !!update, routeMatches: !!update && runtime.route === update.route, sameMap: window.navigationHarness.canvas === runtime.map.getCanvas() && window.navigationHarness.source === runtime.map.getSource('walking-route'), active: navigation.active() };
  });
}
async function state(page: Page): Promise<{ position: unknown; source: string; active: boolean; following: boolean; progress: number; sensor: string; explorationPosition: unknown }> {
  return page.locator('app-workspace').evaluate((element) => {
    const component = (window as unknown as { ng: { getComponent(element: Element): WorkspaceRuntime } }).ng.getComponent(element);
    const navigation = component.navigation;
    return { position: navigation.position(), source: navigation.headingSource(), active: navigation.active(), following: navigation.following(), progress: navigation.progress(), sensor: navigation.sensorStatus(), explorationPosition: component.state.position() };
  });
}

test.beforeEach(async ({ page }) => {
  test.setTimeout(90000);
  test.skip(!process.env['KHKI_MAPS_SIMULATION_URL'], 'Execute npm test para usar a simulação HTTP dos mapas.');
  await page.addInitScript(() => {
    window.navigationHarness = { watches: 0, clears: [], fix: null, failure: null, oldFix: null, sensorPermission: 'granted', sensorRequests: 0, gesture: false, options: null, dataUpdates: 0 };
    Object.defineProperty(navigator.geolocation, 'watchPosition', {
      configurable: true,
      value: (success: PositionCallback, failure: PositionErrorCallback, options: PositionOptions) => {
        const harness = window.navigationHarness;
        harness.watches++;
        harness.oldFix = harness.fix;
        harness.fix = success;
        harness.failure = failure;
        harness.options = options;
        return harness.watches;
      }
    });
    Object.defineProperty(navigator.geolocation, 'clearWatch', { configurable: true, value: (id: number) => window.navigationHarness.clears.push(id) });
    Object.defineProperty(DeviceOrientationEvent, 'requestPermission', {
      configurable: true,
      value: () => {
        const harness = window.navigationHarness;
        harness.sensorRequests++;
        harness.gesture = navigator.userActivation.isActive;
        return Promise.resolve(harness.sensorPermission);
      }
    });
  });
});

test('GPS watch and absolute compass follow an inclined mobile camera while preserving the map and route source', async ({ page }) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await prepare(page);
  expect(await page.evaluate(() => window.navigationHarness.watches)).toBe(0);
  await page.getByRole('button', { name: 'Iniciar navegação', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.navigationHarness.watches)).toBe(1);
  expect(await page.evaluate(() => window.navigationHarness.gesture)).toBe(true);
  expect(await page.evaluate(() => window.navigationHarness.options)).toMatchObject({ enableHighAccuracy: true, maximumAge: 1000 });
  await fix(page);
  await expect(page.locator('.map-position.is-navigating')).toBeVisible();
  await expect.poll(async () => (await camera(page)).pitch).toBeCloseTo(55, 3);
  await expect.poll(async () => (await camera(page)).y / (await camera(page)).availableHeight).toBeGreaterThan(0.55);
  const initialUpdates = await page.evaluate(() => window.navigationHarness.dataUpdates);
  await page.evaluate(() => window.dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute', { absolute: true, alpha: 90, beta: 90, gamma: 0 })));
  await expect.poll(async () => (await state(page)).source).toBe('compass');
  expect(await page.evaluate(() => window.navigationHarness.dataUpdates)).toBe(initialUpdates);
  await fix(page, 0.3);
  await expect.poll(async () => (await state(page)).source).toBe('compass');
  await page.locator('app-map').evaluate((element) => {
    const component = (window as unknown as { ng: { getComponent(element: Element): MapRuntime } }).ng.getComponent(element);
    component.map.fire('dragstart', { originalEvent: new MouseEvent('mousedown') });
  });
  await expect.poll(async () => (await state(page)).following).toBe(false);
  await page.getByRole('button', { name: 'Recentralizar', exact: true }).click();
  await expect.poll(async () => (await state(page)).following).toBe(true);
  await expect.poll(() => page.evaluate(() => window.navigationHarness.dataUpdates)).toBeGreaterThan(initialUpdates);
  const drawnStart = await page.evaluate(() => window.navigationHarness.lastGeometry?.geometry.coordinates[0][0]);
  const gpsPosition = (await state(page)).position as { lat: number; lng: number };
  expect(drawnStart?.[0]).toBeCloseTo(gpsPosition.lng, 5);
  expect(drawnStart?.[1]).toBeCloseTo(gpsPosition.lat, 5);
  expect(
    await page.locator('app-map').evaluate((element) => {
      const component = (window as unknown as { ng: { getComponent(element: Element): MapRuntime } }).ng.getComponent(element);
      return window.navigationHarness.canvas === component.map.getCanvas() && window.navigationHarness.source === component.map.getSource('walking-route');
    })
  ).toBe(true);
  await page.screenshot({ path: '../test-results/navigation-mobile-gps.png' });
  await page.locator('.navigation-hud').getByRole('button', { name: 'Encerrar navegação', exact: true }).click();
  await expect(page.locator('.map-position.is-navigating')).toHaveCount(0);
  await expect.poll(async () => (await camera(page)).pitch).toBe(0);
  expect(await page.evaluate(() => window.navigationHarness.clears)).toEqual([1]);
});

test('denied compass uses GPS and denied geolocation cleans up the watcher', async ({ page }) => {
  await prepare(page);
  await page.evaluate(() => {
    window.navigationHarness.sensorPermission = 'denied';
  });
  await page.getByRole('button', { name: 'Iniciar navegação', exact: true }).click();
  await fix(page);
  await expect.poll(async () => (await state(page)).source).toBe('gps');
  await expect.poll(async () => (await state(page)).sensor).toContain('negada');
  await page.evaluate(() => window.navigationHarness.failure?.({ code: 1 } as GeolocationPositionError));
  await expect.poll(async () => (await state(page)).active).toBe(false);
  await expect(page.getByText('Localização negada. Autorize o GPS no navegador para iniciar a navegação.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.navigationHarness.clears)).toEqual([1]);
});

test('the environment-gated simulator supports pause, progress, restart and arrival without touching GPS', async ({ page }) => {
  await prepare(page);
  const originalPosition = (await state(page)).explorationPosition;
  await expect(page.getByRole('button', { name: 'Simular percurso', exact: true })).toBeHidden();
  await page.locator('.navigation-simulator-toggle').click();
  await page.getByRole('button', { name: 'Simular percurso', exact: true }).click();
  await expect(page.locator('.map-position.is-navigating')).toBeVisible();
  await page.getByRole('button', { name: 'Pausar simulação', exact: true }).click();
  const simulatorBounds = (await page.locator('.navigation-simulator').boundingBox())!;
  const hudBounds = (await page.locator('.navigation-hud').boundingBox())!;
  expect(simulatorBounds.y + simulatorBounds.height).toBeLessThan(hudBounds.y);
  expect(simulatorBounds.y + simulatorBounds.height).toBeGreaterThan(844 / 2);
  await page.locator('.navigation-simulator-toggle').click();
  await expect(page.getByRole('button', { name: 'Continuar simulação', exact: true })).toBeHidden();
  await page.locator('.navigation-simulator-toggle').press('Enter');
  await expect(page.getByRole('button', { name: 'Continuar simulação', exact: true })).toBeVisible();
  const summary = page.locator('.navigation-summary');
  await expect(summary.locator('small')).toHaveText(['Restantes', 'Tempo estimado', 'Chegada']);
  const initialDistance = await summary.locator('strong').nth(0).innerText();
  const initialArrival = await summary.locator('strong').nth(2).innerText();
  const initialDuration = await page.locator('app-workspace').evaluate((element) => (window as unknown as { ng: { getComponent(element: Element): WorkspaceRuntime } }).ng.getComponent(element).navigation.remainingDurationMillis());
  const paused = (await state(page)).position;
  await page.clock.install();
  await page.clock.fastForward(5000);
  await expect(summary.locator('strong').nth(2)).toHaveText(/^\d{2}:\d{2}$/);
  expect((await state(page)).position).toEqual(paused);
  await page.getByRole('button', { name: 'Avançar 10 s', exact: true }).click();
  expect((await state(page)).progress).toBeGreaterThan(0);
  await expect(summary.locator('strong').nth(0)).not.toHaveText(initialDistance);
  const updatedDuration = await page.locator('app-workspace').evaluate((element) => (window as unknown as { ng: { getComponent(element: Element): WorkspaceRuntime } }).ng.getComponent(element).navigation.remainingDurationMillis());
  expect(updatedDuration).toBeLessThan(initialDuration!);
  await page.clock.fastForward(120000);
  await expect(summary.locator('strong').nth(2)).not.toHaveText(initialArrival);
  expect((await state(page)).position).not.toEqual(paused);
  await page.evaluate(() => window.dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute', { absolute: true, alpha: 170, beta: 90, gamma: 0 })));
  expect((await state(page)).source).toBe('simulation');
  expect(await page.evaluate(() => window.navigationHarness.watches + window.navigationHarness.sensorRequests)).toBe(0);
  await page.screenshot({ path: '../test-results/navigation-mobile-simulation.png' });
  await page.getByRole('button', { name: 'Reiniciar', exact: true }).click();
  expect((await state(page)).progress).toBeLessThan(5);
  await page.getByRole('combobox', { name: 'Velocidade da simulação', exact: true }).selectOption('30');
  await page.getByRole('button', { name: 'Avançar 10 s', exact: true }).click();
  await expect(page.locator('.navigation-notice')).toContainText('Simulação concluída');
  await expect(summary.locator('strong').nth(0)).toHaveText('0 m');
  await expect(summary.locator('strong').nth(1)).toHaveText('0 min');
  await expect.poll(() => page.evaluate(() => window.navigationHarness.lastGeometry?.geometry.coordinates.length)).toBe(0);
  await page.getByRole('button', { name: 'Encerrar simulação', exact: true }).click();
  expect((await state(page)).explorationPosition).toEqual(originalPosition);
  await expect(page.locator('.map-position.is-navigating')).toHaveCount(0);
});

test('simulation cannot be activated when the public environment flag is false', async ({ page }) => {
  await prepare(page, false);
  await expect(page.locator('.navigation-simulator')).toHaveCount(0);
  await page.locator('app-workspace').evaluate((element) => {
    const component = (window as unknown as { ng: { getComponent(element: Element): WorkspaceRuntime } }).ng.getComponent(element);
    component.navigation.simulate();
  });
  expect((await state(page)).active).toBe(false);
  expect(await page.evaluate(() => window.navigationHarness.watches)).toBe(0);
});

test('leaving navigation removes the GPS watch and ignores late fixes', async ({ page }) => {
  await prepare(page);
  await page.getByRole('button', { name: 'Iniciar navegação', exact: true }).click();
  await fix(page);
  await expect(page.locator('.map-position.is-navigating')).toBeVisible();
  await page.getByRole('button', { name: 'Editar rota', exact: true }).click();
  await page.getByRole('link', { name: 'Voltar aos detalhes', exact: true }).click();
  await expect(page.locator('app-details')).toBeVisible();
  expect(await page.evaluate(() => window.navigationHarness.clears)).toEqual([1]);
  await page.evaluate(() => window.navigationHarness.fix?.({ coords: { latitude: 10, longitude: 10, accuracy: 5, heading: 0, speed: 1 }, timestamp: Date.now() } as GeolocationPosition));
  await expect(page.locator('.map-position.is-navigating')).toHaveCount(0);
  await expect.poll(async () => (await camera(page)).pitch).toBe(0);
  expect((await state(page)).active).toBe(false);
});

test('invalid and stale GPS samples are ignored and a later valid sample recovers', async ({ page }) => {
  await prepare(page);
  await page.getByRole('button', { name: 'Iniciar navegação', exact: true }).click();
  await page.evaluate(() => window.navigationHarness.fix?.({ coords: { latitude: 0, longitude: 0, accuracy: 5 }, timestamp: Date.now() - 60000 } as GeolocationPosition));
  expect((await state(page)).position).toBe(null);
  await fix(page, 0, { latitude: NaN });
  expect((await state(page)).position).toBe(null);
  await fix(page);
  await expect(page.locator('.map-position.is-navigating')).toBeVisible();
  await page.locator('.navigation-hud').getByRole('button', { name: 'Encerrar navegação', exact: true }).click();
});

test('switching from live navigation to simulation stops GPS and discards its late updates', async ({ page }) => {
  await prepare(page);
  await page.getByRole('button', { name: 'Iniciar navegação', exact: true }).click();
  await fix(page);
  await expect(page.locator('.map-position.is-navigating')).toBeVisible();
  await page.locator('.navigation-simulator-toggle').click();
  await page.getByRole('button', { name: 'Simular percurso', exact: true }).click();
  await page.getByRole('button', { name: 'Pausar simulação', exact: true }).click();
  const simulated = (await state(page)).position;
  expect(await page.evaluate(() => window.navigationHarness.clears)).toEqual([1]);
  await fix(page, 0, { latitude: 10, longitude: 10 });
  expect((await state(page)).position).toEqual(simulated);
  expect((await state(page)).source).toBe('simulation');
  expect(await page.evaluate(() => window.navigationHarness.watches)).toBe(1);
  await page.getByRole('button', { name: 'Encerrar simulação', exact: true }).click();
});

test('confirmed GPS deviations reroute over HTTP while preserving the profile, destination, camera, watcher and map', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await prepare(page);
  const requests: URL[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('/routing')) requests.push(new URL(request.url()));
  });
  await page.clock.install();
  await page.getByRole('button', { name: 'Iniciar navegação', exact: true }).click();
  await fix(page);
  await deviation(page, 100);
  await page.clock.fastForward(6000);
  await deviation(page, 100);
  expect(requests).toHaveLength(0);
  await fix(page);
  await page.clock.fastForward(1000);
  await confirmedDeviation(page);
  await expect.poll(async () => (await navigationStatus(page)).rerouted).toBe(true);
  await expect.poll(async () => (await navigationStatus(page)).routeMatches).toBe(true);
  expect(requests).toHaveLength(1);
  expect(requests[0].searchParams.get('mode')).toBe('drive');
  expect(requests[0].searchParams.get('waypoints')?.split('|')[0]).toBe('-23.546,-46.658');
  const destination = await page.locator('app-route').evaluate((element) => {
    const runtime = (window as unknown as { ng: { getComponent(element: Element): { bathroom: { latitude: number; longitude: number } } } }).ng.getComponent(element);
    return runtime.bathroom.latitude + ',' + runtime.bathroom.longitude;
  });
  expect(requests[0].searchParams.get('waypoints')?.split('|')[1]).toBe(destination);
  expect((await navigationStatus(page)).sameMap).toBe(true);
  expect((await navigationStatus(page)).active).toBe(true);
  expect((await camera(page)).pitch).toBeCloseTo(55);
  expect(await page.evaluate(() => window.navigationHarness.watches)).toBe(1);
  expect(await page.evaluate(() => window.navigationHarness.clears)).toEqual([]);
  await page.clock.fastForward(1000);
  await deviation(page);
  expect(requests).toHaveLength(1);
  await page.locator('.navigation-hud').getByRole('button', { name: 'Encerrar navegação', exact: true }).click();
});

test('failed automatic rerouting keeps the route and waits for the cooldown before recovering over HTTP', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await prepare(page);
  let requests = 0;
  await page.route('**/v1/routing*', (route) => {
    requests++;
    const url = new URL(route.request().url());
    if (requests === 1) url.searchParams.set('simulationScenario', 'unavailable');
    return route.continue({ url: url.toString() });
  });
  await page.clock.install();
  await page.getByRole('button', { name: 'Iniciar navegação', exact: true }).click();
  await fix(page);
  await confirmedDeviation(page);
  await expect(page.locator('.navigation-notice')).toContainText('Não foi possível recalcular agora');
  expect((await navigationStatus(page)).sameMap).toBe(true);
  expect((await navigationStatus(page)).rerouted).toBe(false);
  await advanceGpsTime(page, 1000);
  await deviation(page);
  expect(requests).toBe(1);
  await advanceGpsTime(page, 30000);
  await deviation(page);
  await expect.poll(async () => (await navigationStatus(page)).rerouted).toBe(true);
  expect(requests).toBe(2);
  expect((await navigationStatus(page)).sameMap).toBe(true);
  await page.locator('.navigation-hud').getByRole('button', { name: 'Encerrar navegação', exact: true }).click();
});

test('stopping navigation cancels a pending HTTP reroute and prevents its late result from replacing the route', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await prepare(page);
  await page.route('**/v1/routing*', (route) => {
    const url = new URL(route.request().url());
    url.searchParams.set('simulationScenario', 'slow');
    return route.continue({ url: url.toString() });
  });
  await page.clock.install();
  await page.getByRole('button', { name: 'Iniciar navegação', exact: true }).click();
  await fix(page);
  await confirmedDeviation(page);
  await expect.poll(async () => (await navigationStatus(page)).busy).toBe(true);
  await page.locator('.navigation-hud').getByRole('button', { name: 'Encerrar navegação', exact: true }).click();
  await new Promise((resolve) => setTimeout(resolve, 1800));
  expect((await navigationStatus(page)).active).toBe(false);
  expect((await navigationStatus(page)).rerouted).toBe(false);
  expect((await navigationStatus(page)).sameMap).toBe(true);
  expect(await page.evaluate(() => window.navigationHarness.clears)).toEqual([1]);
});
