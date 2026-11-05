import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api.service';
import { MapsService, TravelMode, TravelRoute } from '../../core/maps.service';
import { Bathroom, ITEM_LABELS, Location, MapArea } from '../../core/models';
import { validPoint } from '../../core/navigation-geometry';
import { OBSERVED_ACCESSIBILITY } from '../../core/bathroom-details';
import { ExplorationFilters, activeFilters, copyFilters, emptyFilters, filterBathrooms, FILTER_DISTANCES } from '../explore/exploration-filters';

export interface RouteDraft {
  origin: string;
  position: Location | null;
  mode: TravelMode;
  route: TravelRoute | null;
  startNavigation?: boolean;
}
export interface PhotoView {
  bathroomId: string;
  name: string;
  photoIds: string[];
  index: number;
}
export type ExplorationScene = 'search' | 'details' | 'route' | 'review' | 'photos' | 'registration';
const MAP_MESSAGE_DURATION_MS = 6000;
const SEARCH_PAGE_SIZE = 200;
const SEARCH_MAX_OFFSET = 100000;

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
  readonly appliedFilters = signal<ExplorationFilters>(emptyFilters());
  readonly filterDraft = signal<ExplorationFilters | null>(null);
  readonly activeFilters = computed(() => activeFilters(this.appliedFilters()));
  readonly filterCount = computed(() => this.activeFilters().length);
  readonly referenceLabel = signal('Minha localização');
  readonly filterViewport = signal(false);
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
  readonly originPicking = signal(false);
  readonly originSelection = signal<Location | null>(null);
  chooseRouteOrigin(point: Location): void {
    if (this.originPicking() && this.scene() === 'route' && validPoint(point)) {
      this.originSelection.set(point);
      this.originPicking.set(false);
    }
  }
  readonly path = signal<TravelRoute | null>(null);
  readonly bounds = signal<MapArea | null>(null);
  readonly area = signal<MapArea | null>(null);
  readonly panelReady = signal(0);
  readonly panelScrolls = new Map<string, number>();
  readonly photoView = signal<PhotoView | null>(null);
  photoOpener: HTMLElement | null = null;
  openPhoto(bathroom: Bathroom, index: number, opener?: HTMLElement): void {
    if (!Number.isSafeInteger(index) || index < 0 || index >= bathroom.photoIds.length) return;
    this.photoOpener = opener || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    this.photoView.set({ bathroomId: bathroom.id, name: bathroom.name, photoIds: [...bathroom.photoIds], index });
  }
  movePhoto(delta: number): void {
    const view = this.photoView();
    if (!view || (delta !== -1 && delta !== 1)) return;
    this.photoView.set({ ...view, index: (((view.index + delta) % view.photoIds.length) + view.photoIds.length) % view.photoIds.length });
  }
  closePhoto(): void {
    const view = this.photoView();
    if (view) this.photoIndexes.set(view.bathroomId, view.index);
    this.photoView.set(null);
    this.photoOpener = null;
  }
  readonly photoIndexes = new Map<string, number>();
  readonly routeDrafts = new Map<string, RouteDraft>();
  readonly visible = computed(() => {
    return filterBathrooms(this.results(), this.appliedFilters(), this.position(), this.area());
  });
  readonly previewCount = computed(() => filterBathrooms(this.results(), this.filterDraft() || this.appliedFilters(), this.position(), this.area()).length);
  readonly filterCategories = computed(() => [...new Set([...this.results().map((bathroom) => bathroom.category), ...(this.filterDraft()?.categories || [])])].filter(Boolean).sort((left, right) => left.localeCompare(right, 'pt-BR')));
  openFilters(): void {
    this.filterDraft.set(copyFilters(this.appliedFilters()));
  }
  closeFilters(): void {
    this.filterDraft.set(null);
  }
  updateFilterDraft(value: Partial<ExplorationFilters>): void {
    this.filterDraft.update((draft) => (draft ? { ...draft, ...value } : null));
  }
  clearFilterDraft(): void {
    this.filterDraft.set(emptyFilters());
  }
  applyFilterDraft(): void {
    const draft = this.filterDraft();
    if (!draft || this.loading() || this.error() || !this.loaded) return;
    this.filterViewport.set(true);
    this.appliedFilters.set({ ...copyFilters(draft), radius: this.position() && validPoint(this.position()!) && FILTER_DISTANCES.includes(draft.radius as (typeof FILTER_DISTANCES)[number]) ? draft.radius : 0 });
    this.closeFilters();
  }
  clearFilters(): void {
    this.closeFilters();
    this.filterViewport.set(true);
    this.appliedFilters.set(emptyFilters());
  }
  toggleShortcut(shortcut: 'accessible' | 'changingTable'): void {
    this.filterViewport.set(true);
    this.closeFilters();
    this.appliedFilters.update((filters) => (shortcut === 'accessible' ? { ...filters, accessible: !filters.accessible } : { ...filters, items: filters.items.includes('CHANGING_TABLE') ? filters.items.filter((item) => item !== 'CHANGING_TABLE') : [...filters.items, 'CHANGING_TABLE'] }));
  }
  removeFilter(key: string): void {
    if (!this.activeFilters().some((filter) => filter.key === key)) return;
    this.closeFilters();
    this.filterViewport.set(true);
    this.appliedFilters.update((filters) => {
      if (key === 'audience' || key === 'charge') return { ...filters, [key]: '' };
      if (key === 'accessible') return { ...filters, accessible: false };
      if (key === 'radius') return { ...filters, radius: 0 };
      const separator = key.indexOf(':');
      const group = key.slice(0, separator) as 'resources' | 'categories' | 'items';
      return { ...filters, [group]: filters[group].filter((value) => value !== key.slice(separator + 1)) };
    });
  }
  toggleDraftOption(group: 'resources' | 'categories' | 'items', value: string): void {
    const allowed = group === 'resources' ? OBSERVED_ACCESSIBILITY.some((option) => option.key === value) : group === 'items' ? Object.hasOwn(ITEM_LABELS, value) : this.filterCategories().includes(value);
    if (!allowed) return;
    this.filterDraft.update((draft) => {
      if (!draft) return null;
      const selected: readonly string[] = draft[group];
      return { ...draft, [group]: selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value] };
    });
  }
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
      const bathrooms: Bathroom[] = [];
      const received = new Set<string>();
      for (let offset = 0; ; offset += SEARCH_PAGE_SIZE) {
        if (offset > SEARCH_MAX_OFFSET) throw new Error('A busca está muito ampla. Informe um nome ou região para continuar.');
        const page = await this.api.get<Bathroom[]>('/bathrooms', offset ? { ...parameters, offset: String(offset) } : parameters);
        if (sequence !== this.sequence) return;
        if (page.some((bathroom) => received.has(bathroom.id))) throw new Error('Não foi possível carregar a busca completa. Tente novamente.');
        page.forEach((bathroom) => received.add(bathroom.id));
        bathrooms.push(...page);
        if (page.length < SEARCH_PAGE_SIZE) break;
      }
      this.results.set(bathrooms);
      this.filterViewport.set(false);
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
    const bathroom = await this.api.get<Bathroom>('/bathrooms/' + id);
    if (sequence === this.selectedSequence) this.selected.set(bathroom);
    return sequence === this.selectedSequence ? bathroom : null;
  }
  enter(scene: ExplorationScene): void {
    this.closeFilters();
    if (scene !== 'details') this.closePhoto();
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
        this.referenceLabel.set('Minha localização');
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
      this.referenceLabel.set('Minha localização');
      this.position.set(point);
      this.order();
      this.showMessage('Localização obtida. As distâncias da lista são em linha reta.');
    } catch (error) {
      if (sequence === this.locationSequence) this.showMessage(this.api.error(error));
    }
  }
  async locateAddress(): Promise<void> {
    const query = this.query.trim();
    if (!query) return;
    const sequence = ++this.locationSequence;
    try {
      const point = await this.maps.geocode(query);
      if (sequence !== this.locationSequence) return;
      this.referenceLabel.set(query);
      this.position.set(point);
      this.order();
      this.showMessage('Mapa centralizado no endereço buscado. Distâncias em linha reta.');
    } catch (error) {
      if (sequence === this.locationSequence) this.showMessage(this.api.error(error));
    }
  }
}
