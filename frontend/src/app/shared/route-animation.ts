import type { Map } from 'maplibre-gl';
import { motionDurationMilliseconds } from './motion-duration';

export function animateRoute(map: Map): { refresh(): void; destroy(): void } {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const layer = 'walking-route';
  let frame: number | undefined;
  let destroyed = false;
  const stop = () => {
    if (frame !== undefined) window.cancelAnimationFrame(frame);
    frame = undefined;
  };
  const refresh = () => {
    stop();
    if (destroyed || !map.getLayer(layer)) return;
    const tokens = getComputedStyle(document.documentElement);
    const number = (name: string) => Number.parseFloat(tokens.getPropertyValue(name));
    const width = number('--route-line-width');
    const dash = number('--route-dash-length');
    const gap = number('--route-gap-length');
    const duration = motionDurationMilliseconds(tokens.getPropertyValue('--motion-route-cycle'));
    const steps = number('--motion-route-steps');
    if (![width, dash, gap, duration, steps].every((value) => Number.isFinite(value) && value > 0)) return;
    map.setPaintProperty(layer, 'line-width', width);
    map.setPaintProperty(layer, 'line-dasharray', [dash, gap]);
    if (preference.matches || document.hidden) return;
    const start = performance.now();
    let previousStep = -1;
    const tick = (time: number) => {
      if (destroyed || !map.getLayer(layer)) {
        frame = undefined;
        return;
      }
      const step = Math.floor(((Math.max(0, time - start) % duration) / duration) * steps);
      if (step !== previousStep) {
        const phase = (step / steps) * (dash + gap);
        map.setPaintProperty(layer, 'line-dasharray', phase <= gap ? [0, phase, dash, gap - phase] : [phase - gap, gap, dash + gap - phase, 0]);
        previousStep = step;
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
  };
  preference.addEventListener('change', refresh);
  document.addEventListener('visibilitychange', refresh);
  return {
    refresh,
    destroy: () => {
      destroyed = true;
      stop();
      preference.removeEventListener('change', refresh);
      document.removeEventListener('visibilitychange', refresh);
    }
  };
}
