import { ChangeDetectorRef, AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild, effect, inject } from '@angular/core';
import type { Map as LibreMap, Marker, GeoJSONSource, AttributionControl } from 'maplibre-gl';
import { Bathroom, Location, MapArea } from '../core/models';
import { MapsService, TravelRoute } from '../core/maps.service';
import { ThemeService } from '../core/theme.service';
import { IconComponent } from './icon.component';
import { animateRoute } from './route-animation';
import { motionDurationMilliseconds } from './motion-duration';

@Component({ selector: 'app-map', imports: [IconComponent], templateUrl: './map.component.html', styleUrl: './map.component.scss' })
export class MapComponent implements AfterViewInit, OnChanges, OnDestroy {
  private static stylesheet?: Promise<void>;
  private readonly changeDetector = inject(ChangeDetectorRef);
  readonly maps = inject(MapsService);
  private readonly theme = inject(ThemeService);
  @ViewChild('canvas') canvas!: ElementRef<HTMLDivElement>;
  @Input() bathrooms: Bathroom[] = [];
  @Input() point: Location | null = null;
  @Input() route: TravelRoute | null = null;
  @Input() editable = false;
  @Input() overlayPanel = false;
  @Input() panelCollapsed = false;
  @Input() selectedId = '';
  @Input() highlightedId = '';
  @Input() preserveViewport = false;
  @Output() hovered = new EventEmitter<string>();
  @Output() boundsChanged = new EventEmitter<MapArea>();
  @Output() selected = new EventEmitter<string>();
  @Output() moved = new EventEmitter<Location>();
  private map?: LibreMap;
  private attribution?: AttributionControl;
  private library?: typeof import('maplibre-gl');
  private markers = new Map<string, Marker>();
  private bathroomSignature = '';
  private renderedRoute: TravelRoute | null = null;
  private routeAnimation?: ReturnType<typeof animateRoute>;
  private observer?: ResizeObserver;
  private destroyed = false;
  private styleLoaded = false;
  private searchCamera?: { center: [number, number]; zoom: number };
  private restoreCamera = false;
  private timer?: number;
  error = ''; loading = false;

  constructor() {
    effect(() => {
      const theme = this.theme.mode();
      if (!this.map || this.destroyed) return;
      this.loading = true; this.error = ''; window.clearTimeout(this.timer);
      this.timer = window.setTimeout(() => this.fail(), 15000);
      this.map.setStyle(this.maps.styleUrl(theme));
    });
  }
  async ngAfterViewInit(): Promise<void> {
    if (!this.maps.configured) return;
    this.loading = true;
    try {
      const [library] = await Promise.all([import('maplibre-gl'), this.loadStyles()]); this.library = library; if (this.destroyed) return;
      this.library.setWorkerUrl(new URL('maplibre-gl-worker.mjs', document.baseURI).toString());
      this.map = new this.library.Map({ container: this.canvas.nativeElement, style: this.maps.styleUrl(this.theme.mode()), center: this.point ? [this.point.lng, this.point.lat] : [-46.650, -23.555], zoom: 14, attributionControl: false });
      this.routeAnimation = animateRoute(this.map);
      this.map.addControl(new this.library.NavigationControl({ showCompass: false }), 'bottom-right');
      this.map.on('moveend', () => { const padding = this.cameraPadding(); const canvas = this.map!.getCanvas(); const northwest = this.map!.unproject([padding.left - 50, 0]); const southeast = this.map!.unproject([canvas.clientWidth, canvas.clientHeight - (padding.bottom - 50)]); this.boundsChanged.emit({ north: northwest.lat, south: southeast.lat, east: southeast.lng, west: northwest.lng }); this.renderMarkers(); });
      this.timer = window.setTimeout(() => this.fail(), 15000);
      this.map.on('style.load', () => { window.clearTimeout(this.timer); this.loading = false; this.error = ''; this.styleTheme(); this.render(!this.styleLoaded, !this.styleLoaded); this.styleLoaded = true; this.changeDetector.markForCheck(); });
      this.map.on('error', () => { if (this.loading) this.fail(); });
      if (this.editable) this.map.on('click', event => this.moved.emit({ lat: event.lngLat.lat, lng: event.lngLat.lng }));
      this.observer = new ResizeObserver(() => this.map?.resize()); this.observer.observe(this.canvas.nativeElement);
    } catch { this.fail(); } finally { this.changeDetector.markForCheck(); }
  }
  private styleTheme(): void {
    if (this.map) { const attributed = Object.keys(this.map.getStyle().sources).length > 0; if (this.library) { if (this.attribution) this.map.removeControl(this.attribution); this.attribution = new this.library.AttributionControl({ compact: false, customAttribution: attributed ? '' : 'Powered by <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">Geoapify</a> | <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a> | <a href="https://openmaptiles.org/" target="_blank" rel="noopener noreferrer">© OpenMapTiles</a>' }); this.map.addControl(this.attribution, 'bottom-left'); } }
    if (!this.map || this.theme.mode() !== 'dark') return;
    const tokens = getComputedStyle(document.documentElement); const color = (name: string) => tokens.getPropertyValue(name).trim();
    for (const layer of this.map.getStyle().layers) {
      if (layer.type === 'background') this.map.setPaintProperty(layer.id, 'background-color', color('--color-map'));
      if (layer.type === 'fill' && layer.id === 'building') this.map.setPaintProperty(layer.id, 'fill-color', color('--color-map-building'));
      if (layer.type === 'fill' && /park|wood/.test(layer.id)) this.map.setPaintProperty(layer.id, 'fill-color', color('--color-map-park'));
      if (layer.type === 'fill' && layer.id === 'water') this.map.setPaintProperty(layer.id, 'fill-color', color('--color-map-water'));
      if (layer.type === 'line' && layer.id.startsWith('highway_')) this.map.setPaintProperty(layer.id, 'line-color', color(layer.id.endsWith('casing') ? '--color-map-road-border' : '--color-map-road'));
      if (layer.type === 'symbol' && layer.layout?.['text-field']) { this.map.setPaintProperty(layer.id, 'text-color', color('--color-map-label')); this.map.setPaintProperty(layer.id, 'text-halo-color', color('--color-map')); this.map.setPaintProperty(layer.id, 'text-halo-width', 1); }
    }
  }
  private loadStyles(): Promise<void> {
    if (!MapComponent.stylesheet) MapComponent.stylesheet = new Promise<void>((resolve, reject) => { const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = new URL('maplibre-gl.css', document.baseURI).toString(); link.onload = () => resolve(); link.onerror = () => { link.remove(); MapComponent.stylesheet = undefined; reject(new Error('Não foi possível carregar os estilos do mapa.')); }; document.head.append(link); });
    return MapComponent.stylesheet;
  }
  private fail(): void { if (this.destroyed) return; window.clearTimeout(this.timer); this.loading = false; this.error = 'Não foi possível carregar o mapa. Confira a conexão, a chave e o limite de uso da Geoapify.'; this.changeDetector.markForCheck(); }
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedId'] && this.map) {
      if (changes['selectedId'].currentValue && !changes['selectedId'].previousValue) { const center = this.map.getCenter(); this.searchCamera = { center: [center.lng, center.lat], zoom: this.map.getZoom() }; }
      if (!changes['selectedId'].currentValue && changes['selectedId'].previousValue) this.restoreCamera = true;
    }
    if (Object.keys(changes).every(key => ['highlightedId', 'panelCollapsed', 'overlayPanel'].includes(key))) { this.decorateMarkers(); return; }
    const signature = this.bathrooms.map(bathroom => bathroom.id + ':' + bathroom.latitude + ':' + bathroom.longitude).sort().join('|'); const bathroomsChanged = signature !== this.bathroomSignature; this.bathroomSignature = signature;
    const updateViewport = !!(changes['route']?.currentValue || changes['point']?.currentValue || changes['selectedId'] || bathroomsChanged && !this.preserveViewport);
    this.render(updateViewport, !!changes['point']);
  }
  private decorateMarkers(): void {
    for (const marker of this.markers.values()) { const element = marker.getElement(); const id = element.dataset['bathroomId']; if (!id) { element.classList.toggle('is-highlighted', !!this.highlightedId && (element.dataset['bathroomIds'] || '').split(',').includes(this.highlightedId)); continue; } element.classList.toggle('is-selected', id === this.selectedId); element.classList.toggle('is-highlighted', id === this.highlightedId); element.setAttribute('aria-pressed', String(id === this.selectedId)); }
  }
  private renderMarkers(): void {
    if (!this.map || !this.library || this.loading || this.error || this.destroyed) return;
    const active = new Set<string>();
    const groups: Bathroom[][] = [];
    for (const bathroom of this.bathrooms) {
      const projected = this.map.project([bathroom.longitude, bathroom.latitude]);
      const group = this.map.getZoom() < 16 && bathroom.id !== this.selectedId ? groups.find(group => group[0].id !== this.selectedId && Math.hypot(this.map!.project([group[0].longitude, group[0].latitude]).x - projected.x, this.map!.project([group[0].longitude, group[0].latitude]).y - projected.y) < 42) : undefined;
      if (group) group.push(bathroom); else groups.push([bathroom]);
    }
    for (const group of groups) {
      const bathroom = group[0]; const key = group.length > 1 ? 'cluster:' + group.map(bathroom => bathroom.id).sort().join(',') : bathroom.id; active.add(key);
      let marker = this.markers.get(key);
      if (!marker) {
        const element = this.pin(bathroom.name);
        if (group.length > 1) {
          element.dataset['bathroomIds'] = group.map(bathroom => bathroom.id).join(','); element.className = 'map-cluster'; element.replaceChildren(document.createTextNode(String(group.length))); element.setAttribute('aria-label', 'Ampliar grupo de ' + group.length + ' banheiros'); element.title = element.getAttribute('aria-label')!;
          element.addEventListener('click', event => { event.stopPropagation(); if (!this.map || !this.library) return; const bounds = new this.library.LngLatBounds(); this.bathrooms.filter(value => (element.dataset['bathroomIds'] || '').split(',').includes(value.id)).forEach(value => bounds.extend([value.longitude, value.latitude])); this.map.fitBounds(bounds, { padding: this.cameraPadding(), maxZoom: Math.min(17, this.map.getZoom() + 2), duration: this.motionDuration() }); });
        } else {
          element.dataset['bathroomId'] = bathroom.id; element.addEventListener('click', event => { event.stopPropagation(); this.selected.emit(bathroom.id); });
          element.addEventListener('mouseenter', () => this.hovered.emit(bathroom.id)); element.addEventListener('mouseleave', () => this.hovered.emit(''));
          element.addEventListener('focus', () => this.hovered.emit(bathroom.id)); element.addEventListener('blur', () => this.hovered.emit(''));
        }
        marker = new this.library.Marker({ element, anchor: group.length > 1 ? 'center' : 'bottom', offset: group.length > 1 ? [0, 0] : [0, 2] }).setLngLat([bathroom.longitude, bathroom.latitude]).addTo(this.map); this.markers.set(key, marker);
      }
      const latitude = group.reduce((sum, value) => sum + value.latitude, 0) / group.length; const longitude = group.reduce((sum, value) => sum + value.longitude, 0) / group.length;
      if (marker.getLngLat().lat !== latitude || marker.getLngLat().lng !== longitude) marker.setLngLat([longitude, latitude]);
    }
    const origin = this.route?.geometry.geometry.coordinates[0]?.[0]; const point = origin ? { lat: origin[1], lng: origin[0] } : this.point;
    if (point) {
      active.add('origin'); const label = this.editable ? 'Localização do banheiro: arraste ou clique no mapa para ajustar' : origin ? 'Origem da rota' : 'Localização selecionada';
      let marker = this.markers.get('origin');
      if (!marker) { marker = new this.library.Marker({ element: this.pin(label, true), draggable: this.editable }).setLngLat([point.lng, point.lat]).addTo(this.map); marker.on('dragend', () => { const point = marker!.getLngLat(); this.moved.emit({ lat: point.lat, lng: point.lng }); }); this.markers.set('origin', marker); }
      marker.getElement().setAttribute('aria-label', label); marker.getElement().title = label;
      if (marker.getLngLat().lat !== point.lat || marker.getLngLat().lng !== point.lng) marker.setLngLat([point.lng, point.lat]);
    }
    for (const [key, marker] of this.markers) if (!active.has(key)) { marker.remove(); this.markers.delete(key); }
    this.decorateMarkers();
  }
  private motionDuration(): number { return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : motionDurationMilliseconds(getComputedStyle(document.documentElement).getPropertyValue('--motion-map-duration')); }
  private cameraPadding(): { top: number; right: number; bottom: number; left: number } {
    const padding = { top: 50, right: 50, bottom: 50, left: 50 }; if (!this.overlayPanel || this.panelCollapsed) return padding;
    const panel = this.canvas.nativeElement.closest('.map-workspace')?.querySelector('.workspace-panel')?.getBoundingClientRect(); if (!panel) return padding;
    if (window.matchMedia('(max-width: 640px)').matches) padding.bottom += panel.height; else padding.left += panel.width; return padding;
  }
  private cameraOffset(): [number, number] { const padding = this.cameraPadding(); return [(padding.left - 50) / 2, -(padding.bottom - 50) / 2]; }

  private pin(label: string, location = false): HTMLButtonElement {
    const button = document.createElement('button'); button.type = 'button'; button.className = location ? 'map-position' : 'map-marker'; button.setAttribute('aria-label', label); button.title = label;
    if (!location) { const image = document.createElement('img'); image.className = 'map-pin'; image.src = new URL('assets/brand/khki-pin.png', document.baseURI).toString(); image.alt = ''; image.width = 50; image.height = 50; image.draggable = false; button.append(image); }
    return button;
  }
  private render(updateViewport = true, focusPoint = false): void {
    if (!this.map || !this.library || this.loading || this.error || this.destroyed) return;
    this.renderMarkers();
    const selected = this.bathrooms.find(bathroom => bathroom.id === this.selectedId);
    if (updateViewport && !this.route && this.restoreCamera && this.searchCamera) { this.map.easeTo({ ...this.searchCamera, duration: this.motionDuration() }); this.restoreCamera = false; }
    else if (updateViewport && !this.route && selected) this.map.flyTo({ center: [selected.longitude, selected.latitude], offset: this.cameraOffset(), zoom: Math.max(this.map.getZoom(), 15), duration: this.motionDuration(), easing: progress => 1 - Math.pow(1 - progress, 3) });
    else if (updateViewport && !this.route && this.point && focusPoint) this.map.panTo([this.point.lng, this.point.lat], { offset: this.cameraOffset(), duration: this.motionDuration() });
    else if (updateViewport && !this.route && !this.preserveViewport && this.bathrooms.length) { const bounds = new this.library.LngLatBounds(); this.bathrooms.forEach(bathroom => bounds.extend([bathroom.longitude, bathroom.latitude])); this.map.fitBounds(bounds, { padding: this.cameraPadding(), maxZoom: 14, duration: 0 }); }
    const source = this.map.getSource('walking-route') as GeoJSONSource | undefined;
    if (this.route) {
      if (source) { if (this.renderedRoute !== this.route) source.setData(this.route.geometry); }
      else {
        this.map.addSource('walking-route', { type: 'geojson', data: this.route.geometry });
        const color = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim();
        this.map.addLayer({ id: 'walking-route', type: 'line', source: 'walking-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': color } });
        this.routeAnimation?.refresh();
      }
      this.renderedRoute = this.route;
      const points = this.route.geometry.geometry.coordinates.flat(); const bounds = new this.library.LngLatBounds(); points.forEach(point => bounds.extend([point[0], point[1]]));
      if (updateViewport && !bounds.isEmpty()) this.map.fitBounds(bounds, { padding: this.cameraPadding(), maxZoom: 17, duration: this.motionDuration() });
    } else if (source) { this.map.removeLayer('walking-route'); this.map.removeSource('walking-route'); this.renderedRoute = null; this.routeAnimation?.refresh(); }
  }
  ngOnDestroy(): void { this.destroyed = true; window.clearTimeout(this.timer); this.routeAnimation?.destroy(); this.observer?.disconnect(); this.markers.forEach(marker => marker.remove()); this.map?.remove(); }
}
