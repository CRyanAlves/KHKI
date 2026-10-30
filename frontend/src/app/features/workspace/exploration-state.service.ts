import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api.service';
import { MapsService, TravelMode, TravelRoute } from '../../core/maps.service';
import { Access, Bathroom, Location, MapArea } from '../../core/models';

export interface RouteDraft {
  origin: string;
  position: Location | null;
  mode: TravelMode;
  route: TravelRoute | null;
}
export type ExplorationScene = 'search' | 'details' | 'route' | 'review' | 'photos';
const MAP_MESSAGE_DURATION_MS = 6000;

@Injectable({ providedIn: 'root' })
export class ExplorationState {
  private readonly api = inject(ApiService);
  private readonly maps = inject(MapsService);
  private sequence = 0;
  private selectedSequence = 0;
  private locationSequence = 0;
  private messageTimer?: ReturnType<typeof setTimeout>;
  loaded = false;
  lastSelected = '';
  query = '';
  access: Access | '' = '';
  accessible = false;
  changingTable = false;
  filters = false;
  sort = 'name';
  readonly results = signal<Bathroom[]>([]);
  readonly selected = signal<Bathroom | null>(null);
  readonly highlighted = signal('');
  readonly scene = signal<ExplorationScene>('search');
  readonly collapsed = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly position = signal<Location | null>(null);
  readonly routeOrigin = signal<Location | null>(null);
  readonly path = signal<TravelRoute | null>(null);
  readonly bounds = signal<MapArea | null>(null);
  readonly area = signal<MapArea | null>(null);
  readonly panelReady = signal(0);
  readonly panelScrolls = new Map<string, number>();
  readonly photoIndexes = new Map<string, number>();
  readonly routeDrafts = new Map<string, RouteDraft>();
  readonly visible = computed(() => {
    const area = this.area();
    return this.results().filter((bathroom) => !area || (bathroom.latitude <= area.north && bathroom.latitude >= area.south && (area.west <= area.east ? bathroom.longitude >= area.west && bathroom.longitude <= area.east : bathroom.longitude >= area.west || bathroom.longitude <= area.east)));
  });
  readonly mapBathrooms = computed(() => {
    const results = this.visible();
    const selected = this.selected();
    return selected && !results.some((bathroom) => bathroom.id === selected.id) ? [...results, selected] : results;
  });
  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.messageTimer));
  }
  private showMessage(message: string): void {
    clearTimeout(this.messageTimer);
    this.message.set(message);
    this.messageTimer = setTimeout(() => this.dismissMessage(), MAP_MESSAGE_DURATION_MS);
  }
  dismissMessage(): void {
    clearTimeout(this.messageTimer);
    this.messageTimer = undefined;
    this.message.set('');
  }
  async search(inArea = false): Promise<void> {
    const sequence = ++this.sequence;
    const area = inArea ? this.bounds() : null;
    this.loading.set(true);
    this.error.set('');
    try {
      const parameters: Record<string, string> = { q: this.query };
      if (this.access) parameters['access'] = this.access;
      if (this.accessible) parameters['accessible'] = 'true';
      const bathrooms = await this.api.get<Bathroom[]>('/bathrooms', parameters);
      if (sequence !== this.sequence) return;
      this.results.set(this.changingTable ? bathrooms.filter((bathroom) => bathroom.items.includes('CHANGING_TABLE')) : bathrooms);
      this.area.set(area);
      this.order();
      this.loaded = true;
      if (inArea) this.showMessage('Resultados filtrados pela área visível do mapa.');
    } catch (error) {
      if (sequence === this.sequence) this.error.set(this.api.error(error));
    } finally {
      if (sequence === this.sequence) this.loading.set(false);
    }
  }
  order(): void {
    this.results.update((bathrooms) => [...bathrooms].sort((left, right) => (this.sort === 'rating' ? (right.rating ?? -1) - (left.rating ?? -1) : this.sort === 'distance' && this.position() ? (this.distance(left) ?? Infinity) - (this.distance(right) ?? Infinity) : left.name.localeCompare(right.name, 'pt-BR'))));
  }
  distance(bathroom: Bathroom): number | null {
    const point = this.position();
    if (!point) return null;
    const radians = Math.PI / 180;
    const deltaLatitude = (bathroom.latitude - point.lat) * radians;
    const deltaLongitude = (bathroom.longitude - point.lng) * radians;
    const haversine = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(point.lat * radians) * Math.cos(bathroom.latitude * radians) * Math.sin(deltaLongitude / 2) ** 2;
    return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(Math.max(0, 1 - haversine))));
  }
  async select(id: string): Promise<Bathroom | null> {
    const sequence = ++this.selectedSequence;
    if (this.selected()?.id !== id) this.selected.set(this.results().find((bathroom) => bathroom.id === id) || null);
    try {
      const bathroom = await this.api.get<Bathroom>('/bathrooms/' + id);
      if (sequence === this.selectedSequence) this.selected.set(bathroom);
      return sequence === this.selectedSequence ? bathroom : null;
    } catch (error) {
      if (sequence === this.selectedSequence) this.error.set(this.api.error(error));
      throw error;
    }
  }
  enter(scene: ExplorationScene): void {
    this.scene.set(scene);
    this.collapsed.set(false);
    this.highlighted.set('');
    this.error.set('');
    if (scene !== 'route') {
      this.path.set(null);
      this.routeOrigin.set(null);
    }
    if (scene === 'search') {
      this.lastSelected = this.selected()?.id || this.lastSelected;
      this.selectedSequence++;
      this.selected.set(null);
    }
  }
  async restoreLocation(): Promise<void> {
    if (this.position() || this.locationSequence) return;
    const sequence = this.locationSequence;
    try {
      const point = await this.maps.locationIfGranted();
      if (point && sequence === this.locationSequence && !this.position()) {
        this.position.set(point);
        this.order();
      }
    } catch {}
  }
  async locate(): Promise<void> {
    const sequence = ++this.locationSequence;
    this.showMessage('Sua localização será usada apenas para centralizar o mapa.');
    try {
      const point = await this.maps.location();
      if (sequence !== this.locationSequence) return;
      this.position.set(point);
      this.order();
      this.showMessage('Localização obtida. As distâncias da lista são em linha reta.');
    } catch (error) {
      if (sequence === this.locationSequence) this.showMessage(this.api.error(error));
    }
  }
  async locateAddress(): Promise<void> {
    if (!this.query.trim()) return;
    const sequence = ++this.locationSequence;
    try {
      const point = await this.maps.geocode(this.query);
      if (sequence !== this.locationSequence) return;
      this.position.set(point);
      this.order();
      this.showMessage('Mapa centralizado no endereço buscado. Distâncias em linha reta.');
    } catch (error) {
      if (sequence === this.locationSequence) this.showMessage(this.api.error(error));
    }
  }
}
