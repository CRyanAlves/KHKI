import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import type { Location } from './models';
import { MapsService, TravelMode, TravelRoute } from './maps.service';
import { RouteTrack, bearing, buildTrack, compassHeading, distanceMeters, headingDelta, nearestProgress, normalizeHeading, remainingTrack, sampleTrack, validPoint } from './navigation-geometry';
import { NAVIGATION_POLICY } from './navigation-policy';
import { TRAVEL_MODES } from './travel-modes';

export interface NavigationFrame {
  position: Location;
  heading: number;
  accuracy: number | null;
  following: boolean;
  remainingGeometry: TravelRoute['geometry'] | null;
}
type OrientationConstructor = typeof DeviceOrientationEvent & { requestPermission?: (absolute?: boolean) => Promise<PermissionState> };

@Injectable({ providedIn: 'root' })
export class NavigationService {
  readonly simulationEnabled = window.KHKI_CONFIG?.devRouteSimulation === true;
  readonly active = signal(false);
  readonly following = signal(true);
  readonly simulated = signal(false);
  readonly paused = signal(false);
  readonly arrived = signal(false);
  readonly position = signal<Location | null>(null);
  readonly heading = signal(0);
  readonly accuracy = signal<number | null>(null);
  readonly traveled = signal(0);
  readonly total = signal(0);
  readonly speedMultiplier = signal(1);
  readonly notice = signal('');
  readonly recalculating = signal(false);
  readonly rerouted = signal<{ route: TravelRoute; origin: Location } | null>(null);
  private readonly maps = inject(MapsService);
  private readonly itinerary = signal<TravelRoute | null>(null);
  private readonly remainingGeometry = computed(() => {
    const route = this.itinerary();
    const traveled = this.traveled();
    return this.active() && route && this.track ? remainingTrack(this.track, traveled) : null;
  });
  readonly sensorStatus = signal('Orientação pelo GPS');
  readonly headingSource = signal<'route' | 'gps' | 'compass' | 'simulation'>('route');
  readonly frame = computed<NavigationFrame | null>(() => {
    const position = this.position();
    return this.active() && position ? { position, heading: this.heading(), accuracy: this.accuracy(), following: this.following(), remainingGeometry: this.remainingGeometry() } : null;
  });
  readonly progress = computed(() => (this.total() ? Math.min(100, (this.traveled() / this.total()) * 100) : 0));
  readonly remainingMeters = computed(() => Math.max(0, this.total() - this.traveled()));
  private route: TravelRoute | null = null;
  private mode: TravelMode = 'drive';
  private track: RouteTrack | null = null;
  private watchId: number | null = null;
  private generation = 0;
  private simulationTimer?: ReturnType<typeof setInterval>;
  private orientationTimer?: ReturnType<typeof setTimeout>;
  private lastTick = 0;
  private compass: number | null = null;
  private compassAt = 0;
  private gpsHeading: number | null = null;
  private orientationAt = 0;
  private offRouteSince: number | null = null;
  private offRouteSamples = 0;
  private lastOffRouteFix = 0;
  private lastRerouteAt = -Infinity;
  private rerouteController: AbortController | null = null;
  private rerouteError = '';
  private readonly onOrientation = (event: DeviceOrientationEvent) => {
    if (!this.active() || this.simulated()) return;
    const now = performance.now();
    if (now - this.orientationAt < 120) return;
    const value = compassHeading(event, screen.orientation?.angle ?? 0);
    if (value === null) return;
    this.orientationAt = now;
    this.compass = value;
    this.compassAt = Date.now();
    this.sensorStatus.set('Bússola do aparelho ativa');
    this.updateHeading();
  };
  private readonly onPageHide = () => this.stop();
  constructor() {
    window.addEventListener('pagehide', this.onPageHide);
    inject(DestroyRef).onDestroy(() => {
      this.stop();
      window.removeEventListener('pagehide', this.onPageHide);
    });
  }
  prepare(route: TravelRoute, mode: TravelMode): void {
    if (this.route !== route) this.stop();
    this.route = route;
    this.mode = mode;
  }
  private initialize(route: TravelRoute): boolean {
    this.stop();
    try {
      this.track = buildTrack(route);
      this.route = route;
      this.itinerary.set(route);
      this.total.set(this.track.length);
      this.heading.set(this.track.edges[0].heading);
      this.active.set(true);
      return true;
    } catch (error) {
      this.notice.set(error instanceof Error ? error.message : 'Não foi possível iniciar a navegação.');
      return false;
    }
  }
  start(): void {
    if (!this.route || !this.initialize(this.route)) return;
    const generation = this.generation;
    if (!navigator.geolocation?.watchPosition || !window.isSecureContext) {
      this.stop();
      this.notice.set('A navegação precisa de localização disponível em uma conexão HTTPS.');
      return;
    }
    this.requestOrientation();
    this.notice.set('Aguardando uma posição atual do GPS…');
    try {
      const id = navigator.geolocation.watchPosition(
        (fix) => this.receiveFix(fix, generation),
        (error) => {
          if (generation !== this.generation || this.simulated()) return;
          if (error.code === 1) {
            this.stop();
            this.notice.set('Localização negada. Autorize o GPS no navegador para iniciar a navegação.');
          } else this.notice.set('O GPS está temporariamente indisponível. Aguardando uma nova posição…');
        },
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
      );
      if (generation === this.generation && this.active()) this.watchId = id;
      else navigator.geolocation.clearWatch(id);
    } catch {
      this.stop();
      this.notice.set('Não foi possível iniciar o acompanhamento do GPS.');
    }
  }
  private receiveFix(fix: GeolocationPosition, generation: number): void {
    if (generation !== this.generation || !this.active() || this.simulated() || this.arrived() || !this.track) return;
    const point = { lat: fix.coords.latitude, lng: fix.coords.longitude };
    const accuracy = fix.coords.accuracy;
    if (!validPoint(point) || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100000 || !Number.isFinite(fix.timestamp) || Date.now() - fix.timestamp > 30000 || fix.timestamp - Date.now() > 10000) {
      this.notice.set('O GPS retornou uma posição inválida ou antiga. Aguardando atualização…');
      return;
    }
    const previous = this.position();
    const heading = fix.coords.heading;
    if (typeof heading === 'number' && Number.isFinite(heading) && heading >= 0 && heading < 360 && Number.isFinite(fix.coords.speed) && (fix.coords.speed ?? 0) >= 0.5) this.gpsHeading = heading;
    else if (previous && distanceMeters(previous, point) >= Math.max(5, Math.min(accuracy, 20))) this.gpsHeading = bearing(previous, point);
    this.position.set(point);
    this.accuracy.set(accuracy);
    const progress = nearestProgress(this.track, point);
    const onRoute = progress.distance <= Math.max(NAVIGATION_POLICY.deviationMeters, accuracy);
    if (onRoute && accuracy <= NAVIGATION_POLICY.maximumRerouteAccuracyMeters) this.traveled.set(Math.max(this.traveled(), progress.traveled));
    this.notice.set(accuracy > NAVIGATION_POLICY.maximumRerouteAccuracyMeters ? 'Precisão do GPS baixa. Aguarde uma posição mais precisa.' : !onRoute ? this.rerouteError || (this.recalculating() ? 'Recalculando a rota a partir da sua posição…' : 'Desvio detectado. Confirmando sua posição para recalcular…') : '');
    this.checkDeviation(point, accuracy, fix.timestamp, onRoute);
    this.updateHeading();
    const destination = this.track.edges[this.track.edges.length - 1].end;
    if (accuracy <= 30 && distanceMeters(point, destination) <= 15 && this.progress() > 80) {
      this.traveled.set(this.total());
      this.arrived.set(true);
      this.notice.set('Você chegou às proximidades do destino.');
      this.releaseSensors();
      this.cancelReroute();
    }
  }
  private checkDeviation(point: Location, accuracy: number, timestamp: number, onRoute: boolean): void {
    if (onRoute || accuracy > NAVIGATION_POLICY.maximumRerouteAccuracyMeters) {
      this.offRouteSince = null;
      this.offRouteSamples = 0;
      this.lastOffRouteFix = 0;
      this.cancelReroute();
      if (onRoute) this.rerouteError = '';
      return;
    }
    if (timestamp <= this.lastOffRouteFix) return;
    this.lastOffRouteFix = timestamp;
    this.offRouteSince ??= timestamp;
    this.offRouteSamples++;
    if (this.offRouteSamples >= NAVIGATION_POLICY.deviationSamples && timestamp - this.offRouteSince >= NAVIGATION_POLICY.deviationDurationMillis && !this.rerouteController && Date.now() - this.lastRerouteAt >= NAVIGATION_POLICY.rerouteCooldownMillis) void this.recalculate(point);
  }
  private cancelReroute(): void {
    this.rerouteController?.abort();
    this.rerouteController = null;
    this.recalculating.set(false);
  }
  private async recalculate(origin: Location): Promise<void> {
    if (!this.track || !this.route || !this.active() || this.simulated() || this.arrived()) return;
    const generation = this.generation;
    const previousRoute = this.route;
    const destination = this.track.edges[this.track.edges.length - 1].end;
    const controller = new AbortController();
    this.rerouteController = controller;
    this.lastRerouteAt = Date.now();
    this.rerouteError = '';
    this.recalculating.set(true);
    this.notice.set('Recalculando a rota a partir da sua posição…');
    try {
      const route = await this.maps.directions(origin, destination, this.mode, controller.signal);
      if (controller.signal.aborted || generation !== this.generation || !this.active() || this.simulated() || this.arrived() || this.route !== previousRoute) return;
      const track = buildTrack(route);
      const progress = nearestProgress(track, this.position() || origin);
      this.track = track;
      this.route = route;
      this.itinerary.set(route);
      this.total.set(track.length);
      this.traveled.set(progress.distance <= NAVIGATION_POLICY.deviationMeters ? progress.traveled : 0);
      this.offRouteSince = null;
      this.offRouteSamples = 0;
      this.lastOffRouteFix = 0;
      this.rerouted.set({ route, origin });
      this.notice.set('Rota recalculada a partir da sua posição.');
    } catch {
      if (!controller.signal.aborted && generation === this.generation) {
        this.rerouteError = 'Não foi possível recalcular agora. A rota anterior foi mantida; tentaremos novamente ao receber novas posições.';
        this.notice.set(this.rerouteError);
      }
    } finally {
      if (this.rerouteController === controller) {
        this.rerouteController = null;
        this.recalculating.set(false);
      }
    }
  }
  requestOrientation(): void {
    if (!this.active() || this.simulated()) return;
    const generation = this.generation;
    const constructor = window.DeviceOrientationEvent as OrientationConstructor | undefined;
    if (!constructor) {
      this.sensorStatus.set('Bússola indisponível; usando direção do GPS');
      return;
    }
    const attach = () => {
      if (generation !== this.generation || !this.active() || this.simulated()) return;
      window.removeEventListener('deviceorientation', this.onOrientation);
      window.removeEventListener('deviceorientationabsolute', this.onOrientation);
      window.addEventListener('deviceorientation', this.onOrientation);
      window.addEventListener('deviceorientationabsolute', this.onOrientation);
      this.sensorStatus.set('Aguardando orientação absoluta; GPS como alternativa');
      clearTimeout(this.orientationTimer);
      this.orientationTimer = setTimeout(() => {
        if (generation === this.generation && this.compass === null) this.sensorStatus.set('Sem bússola absoluta; usando direção do GPS');
      }, 5000);
    };
    if (constructor.requestPermission) {
      try {
        void constructor
          .requestPermission(true)
          .then((permission) => {
            if (generation !== this.generation) return;
            if (permission === 'granted') attach();
            else this.sensorStatus.set('Permissão da bússola negada; usando direção do GPS');
          })
          .catch(() => {
            if (generation === this.generation) this.sensorStatus.set('Bússola indisponível; usando direção do GPS');
          });
      } catch {
        this.sensorStatus.set('Ative a bússola pelo botão de orientação.');
      }
    } else attach();
  }
  private updateHeading(): void {
    const compass = this.compass !== null && Date.now() - this.compassAt < 8000;
    const next = compass ? this.compass! : (this.gpsHeading ?? (this.track ? sampleTrack(this.track, this.traveled()).heading : this.heading()));
    this.headingSource.set(compass ? 'compass' : this.gpsHeading !== null ? 'gps' : 'route');
    const delta = headingDelta(this.heading(), next);
    if (Math.abs(delta) >= 1) this.heading.set(normalizeHeading(this.heading() + delta * 0.35));
  }
  simulate(route: TravelRoute | null = this.route): void {
    if (!this.simulationEnabled || !route || !this.initialize(route)) return;
    this.simulated.set(true);
    this.sensorStatus.set('Orientação calculada pelo trajeto simulado');
    this.headingSource.set('simulation');
    this.applySimulation();
    this.resumeSimulation();
  }
  pauseSimulation(): void {
    if (!this.simulated()) return;
    clearInterval(this.simulationTimer);
    this.simulationTimer = undefined;
    this.paused.set(true);
  }
  resumeSimulation(): void {
    if (!this.simulationEnabled || !this.simulated() || this.arrived()) return;
    clearInterval(this.simulationTimer);
    this.paused.set(false);
    this.lastTick = performance.now();
    this.simulationTimer = setInterval(() => {
      const now = performance.now();
      const elapsed = Math.min(2, Math.max(0, (now - this.lastTick) / 1000));
      this.lastTick = now;
      this.advanceSimulation(elapsed);
    }, 200);
  }
  setSimulationSpeed(value: number): void {
    if (this.simulationEnabled && [1, 5, 10, 30].includes(value)) this.speedMultiplier.set(value);
  }
  advanceSimulation(seconds: number): void {
    if (!this.simulationEnabled || !this.simulated() || !this.track || !Number.isFinite(seconds) || seconds < 0 || seconds > 60) return;
    this.traveled.set(Math.min(this.track.length, this.traveled() + seconds * TRAVEL_MODES.find((mode) => mode.value === this.mode)!.simulationSpeed * this.speedMultiplier()));
    this.applySimulation();
    if (this.traveled() >= this.track.length) {
      this.pauseSimulation();
      this.arrived.set(true);
      this.notice.set('Simulação concluída no destino.');
    }
  }
  private applySimulation(): void {
    if (!this.track) return;
    const sample = sampleTrack(this.track, this.traveled());
    this.position.set(sample.point);
    this.heading.set(sample.heading);
    this.accuracy.set(null);
  }
  recenter(): void {
    if (this.active()) this.following.set(true);
  }
  pauseFollow(): void {
    if (this.active()) this.following.set(false);
  }
  private releaseSensors(): void {
    if (this.watchId !== null) {
      navigator.geolocation?.clearWatch(this.watchId);
      this.watchId = null;
    }
    clearTimeout(this.orientationTimer);
    window.removeEventListener('deviceorientation', this.onOrientation);
    window.removeEventListener('deviceorientationabsolute', this.onOrientation);
  }
  stop(): void {
    this.generation++;
    this.cancelReroute();
    this.itinerary.set(null);
    this.rerouted.set(null);
    this.offRouteSince = null;
    this.offRouteSamples = 0;
    this.lastOffRouteFix = 0;
    this.lastRerouteAt = -Infinity;
    this.rerouteError = '';
    this.releaseSensors();
    clearInterval(this.simulationTimer);
    this.simulationTimer = undefined;
    this.active.set(false);
    this.simulated.set(false);
    this.paused.set(false);
    this.following.set(true);
    this.arrived.set(false);
    this.position.set(null);
    this.accuracy.set(null);
    this.traveled.set(0);
    this.total.set(0);
    this.compass = null;
    this.gpsHeading = null;
    this.compassAt = 0;
    this.orientationAt = 0;
    this.notice.set('');
    this.headingSource.set('route');
    this.sensorStatus.set('Orientação pelo GPS');
  }
}
