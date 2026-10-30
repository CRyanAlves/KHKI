import { expect, test } from '@playwright/test';
import type { TravelRoute } from '../src/app/core/maps.service';
import type { Map } from 'maplibre-gl';

interface MapRuntime {
  map: Map;
  route: TravelRoute | null;
  render(updateViewport: boolean): void;
}
declare global {
  interface Window {
    routeTest?: { component: MapRuntime; canvas: HTMLCanvasElement; source: unknown; dataUpdates: number };
  }
}

test('route dashes animate without recreating the map or geometry and stop for reduced motion', async ({ page }) => {
  await page.route('**/config.js', (route) => route.fulfill({ contentType: 'application/javascript', body: "window.KHKI_CONFIG = { geoapifyApiKey: 'browser-test' };" }));
  await page.route(
    (url) => url.pathname.endsWith('/style.json'),
    (route) => route.fulfill({ json: { version: 8, sources: {}, layers: [] } })
  );
  await page.goto('/');
  await page.waitForFunction(() => {
    const runtime = window as unknown as { ng: { getComponent(element: Element | null): MapRuntime } };
    return runtime.ng?.getComponent(document.querySelector('app-map'))?.map?.isStyleLoaded();
  });
  await page.locator('app-map').evaluate((element) => {
    const component = (window as unknown as { ng: { getComponent(element: Element): MapRuntime } }).ng.getComponent(element);
    component.route = {
      geometry: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'MultiLineString',
          coordinates: [
            [
              [-46.65, -23.55],
              [-46.648, -23.551],
              [-46.646, -23.552]
            ]
          ]
        }
      }
    };
    component.render(false);
    const source = component.map.getSource('walking-route') as { setData: (...values: unknown[]) => unknown };
    const setData = source.setData.bind(source);
    window.routeTest = { component, canvas: component.map.getCanvas(), source, dataUpdates: 0 };
    source.setData = (...values: unknown[]) => {
      window.routeTest!.dataUpdates++;
      return setData(...values);
    };
  });
  const pattern = () => page.evaluate(() => JSON.stringify(window.routeTest!.component.map.getPaintProperty('walking-route', 'line-dasharray')));
  const first = await pattern();
  await expect.poll(pattern).not.toBe(first);
  expect(await page.evaluate(() => window.routeTest!.dataUpdates)).toBe(0);
  expect(await page.evaluate(() => window.routeTest!.canvas === document.querySelector('.maplibregl-canvas') && window.routeTest!.source === window.routeTest!.component.map.getSource('walking-route'))).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(pattern).toBe('[1,1.5]');
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  expect(await pattern()).toBe('[1,1.5]');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(pattern).not.toBe('[1,1.5]');
  await page.locator('.theme-toggle').click();
  await expect.poll(() => page.evaluate(() => !!window.routeTest!.component.map.getLayer('walking-route'))).toBe(true);
  const afterTheme = await pattern();
  await expect.poll(pattern).not.toBe(afterTheme);
  expect(await page.evaluate(() => window.routeTest!.canvas === document.querySelector('.maplibregl-canvas'))).toBe(true);
  await page.locator('.panel-toggle').click();
  const afterPanel = await pattern();
  await expect.poll(pattern).not.toBe(afterPanel);
  await page.evaluate(() => {
    window.routeTest!.component.route = null;
    window.routeTest!.component.render(false);
  });
  expect(await page.evaluate(() => window.routeTest!.component.map.getLayer('walking-route'))).toBeUndefined();
  await page.goto('about:blank');
  await expect(page.locator('app-map')).toHaveCount(0);
});
