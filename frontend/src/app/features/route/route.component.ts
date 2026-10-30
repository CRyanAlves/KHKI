import { ChangeDetectorRef, Component, DestroyRef, OnDestroy, OnInit, ViewEncapsulation, effect, inject, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { ExplorationState } from '../workspace/exploration-state.service';
import { ApiService } from '../../core/api.service';
import { Bathroom, Location } from '../../core/models';
import { MapsService, TravelMode, TravelRoute } from '../../core/maps.service';
import { TRAVEL_MODES, isTravelMode } from '../../core/travel-modes';
import { validPoint } from '../../core/navigation-geometry';
import { NavigationService } from '../../core/navigation.service';
import { IconComponent } from '../../shared/icon.component';
import { SkeletonComponent } from '../../shared/skeleton.component';
import { OriginChoice, OriginPickerComponent } from './origin-picker.component';
import { formatRouteDuration } from '../../core/route-guidance';

@Component({ selector: 'app-route', imports: [SkeletonComponent, RouterLink, DecimalPipe, IconComponent, OriginPickerComponent], styleUrl: '../../../styles/workspace-route.scss', encapsulation: ViewEncapsulation.None, templateUrl: './route.component.html' })
export class RouteComponent implements OnInit, OnDestroy {
  readonly state = inject(ExplorationState);
  readonly navigation = inject(NavigationService);
  readonly modes = TRAVEL_MODES;
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly api = inject(ApiService);
  private readonly activatedRoute = inject(ActivatedRoute);
  readonly maps = inject(MapsService);
  private loadSequence = 0;
  private calculation = 0;
  private controller?: AbortController;
  private pendingKey = '';
  private wasPickingOrigin = false;
  private readonly cache = new Map<string, TravelRoute>();
  bathroom: Bathroom | null = null;
  origin = '';
  position: Location | null = null;
  route: TravelRoute | null = null;
  mode: TravelMode = 'drive';
  busy = false;
  loading = true;
  error = '';
  constructor() {
    effect(() => {
      const update = this.navigation.rerouted();
      if (!update || !this.navigation.active() || !this.bathroom) return;
      this.route = update.route;
      this.position = update.origin;
      this.origin = 'Minha localização';
      this.state.path.set(update.route);
      this.state.routeOrigin.set(update.origin);
      this.saveDraft();
      this.changeDetector.markForCheck();
    });
    effect(() => {
      const point = this.state.originSelection();
      if (!point) return;
      this.state.originSelection.set(null);
      this.chooseOrigin({ label: 'Ponto marcado no mapa', position: point });
    });
    effect(() => {
      const picking = this.state.originPicking();
      const selection = this.state.originSelection();
      if (this.wasPickingOrigin && !picking && !selection && this.position && !this.route && !this.busy)
        untracked(() => {
          void this.calculate();
        });
      this.wasPickingOrigin = picking;
    });
  }
  get transport() {
    return this.modes.find((mode) => mode.value === this.mode)!;
  }
  get destination(): Location | null {
    return this.bathroom ? { lat: this.bathroom.latitude, lng: this.bathroom.longitude } : null;
  }
  get durationLabel(): string {
    return formatRouteDuration(this.route?.durationMillis);
  }
  ngOnInit(): void {
    this.state.enter('route');
    this.activatedRoute.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((parameters) => {
      void this.load(parameters.get('id')!);
    });
  }
  private async load(id: string): Promise<void> {
    const previous = this.position ? { origin: this.origin, position: this.position, mode: this.mode } : null;
    this.saveDraft();
    this.resetRoute();
    this.state.originPicking.set(false);
    this.state.originSelection.set(null);
    this.loading = true;
    this.bathroom = null;
    this.origin = '';
    this.position = null;
    this.mode = 'drive';
    const sequence = ++this.loadSequence;
    const draft = this.state.routeDrafts.get(id);
    if (draft) {
      this.origin = draft.origin || (draft.position ? 'Minha localização' : '');
      this.position = draft.position;
      this.mode = draft.mode;
      this.route = draft.route;
    } else if (previous) {
      this.origin = previous.origin;
      this.position = previous.position;
      this.mode = previous.mode;
    }
    this.state.path.set(this.route);
    this.state.routeOrigin.set(this.position);
    try {
      const bathroom = await this.state.select(id);
      if (sequence !== this.loadSequence || this.destroyRef.destroyed) return;
      this.bathroom = bathroom;
      if (this.route) this.navigation.prepare(this.route, this.mode);
      else if (this.position && this.bathroom) void this.calculate();
    } catch (error) {
      if (sequence === this.loadSequence) this.error = this.api.error(error);
    } finally {
      if (sequence === this.loadSequence) this.loading = false;
      this.changeDetector.markForCheck();
      this.state.panelReady.update((value) => value + 1);
    }
  }
  ngOnDestroy(): void {
    this.navigation.stop();
    this.state.originPicking.set(false);
    this.state.originSelection.set(null);
    this.loadSequence++;
    this.cancelCalculation();
    this.saveDraft();
  }
  private saveDraft(): void {
    if (this.bathroom) this.state.routeDrafts.set(this.bathroom.id, { origin: this.origin, position: this.position, mode: this.mode, route: this.route });
  }
  private cancelCalculation(): void {
    this.controller?.abort();
    this.controller = undefined;
    this.calculation++;
    this.pendingKey = '';
    this.busy = false;
  }
  private resetRoute(): void {
    this.navigation.stop();
    this.cancelCalculation();
    this.route = null;
    this.error = '';
    this.state.path.set(null);
  }
  setMode(mode: TravelMode): void {
    if (!isTravelMode(mode) || mode === this.mode) return;
    this.mode = mode;
    this.resetRoute();
    this.saveDraft();
    if (this.position) void this.calculate();
  }
  modeKeydown(event: KeyboardEvent, index: number): void {
    const direction = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0;
    if (!direction && !['Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? this.modes.length - 1 : (index + direction + this.modes.length) % this.modes.length;
    this.setMode(this.modes[next].value);
    (event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
  }
  originChanged(value = this.origin): void {
    this.origin = value;
    this.position = null;
    this.state.routeOrigin.set(null);
    this.state.originPicking.set(false);
    this.resetRoute();
    this.saveDraft();
  }
  chooseOrigin(choice: OriginChoice): void {
    if (!validPoint(choice.position) || !choice.label.trim() || choice.label.length > 500) return;
    this.state.originPicking.set(false);
    this.origin = choice.label;
    this.position = choice.position;
    this.state.routeOrigin.set(choice.position);
    this.resetRoute();
    this.saveDraft();
    void this.calculate();
  }
  selectOnMap(): void {
    this.navigation.stop();
    this.cancelCalculation();
    this.error = '';
    this.state.originSelection.set(null);
    this.state.originPicking.set(true);
  }
  async calculate(): Promise<void> {
    const destination = this.destination;
    const position = this.position;
    if (!destination || !position || !validPoint(position) || !validPoint(destination)) return;
    const mode = this.mode;
    const key = JSON.stringify([position, destination, mode]);
    if (this.pendingKey === key) return;
    this.navigation.stop();
    this.cancelCalculation();
    const sequence = this.calculation;
    const controller = new AbortController();
    this.controller = controller;
    this.pendingKey = key;
    this.route = null;
    this.state.path.set(null);
    this.error = '';
    this.busy = true;
    try {
      const route = this.cache.get(key) || (await this.maps.directions(position, destination, mode, controller.signal));
      if (sequence !== this.calculation || controller.signal.aborted || this.destroyRef.destroyed) return;
      if (this.cache.size >= 20) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key, route);
      this.route = route;
      this.navigation.prepare(route, mode);
      this.state.path.set(route);
      this.saveDraft();
    } catch (error) {
      if (sequence === this.calculation && !controller.signal.aborted) this.error = this.api.error(error);
    } finally {
      if (sequence === this.calculation) {
        this.busy = false;
        this.pendingKey = '';
        this.controller = undefined;
        this.changeDetector.markForCheck();
      }
    }
  }
}
