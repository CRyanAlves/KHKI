import type { RegisterComponent } from '../register/register.component';
import { DecimalPipe } from '@angular/common';
import { Bathroom, Location } from '../../core/models';
import { ApiService } from '../../core/api.service';
import { distanceMeters, validPoint } from '../../core/navigation-geometry';
import { Component, DestroyRef, ElementRef, OnInit, ViewChild, ViewEncapsulation, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ExplorationState } from './exploration-state.service';
import { MapComponent } from '../../shared/map.component';
import { IconComponent } from '../../shared/icon.component';
import { NavigationService } from '../../core/navigation.service';
import { NavigationToolsComponent } from '../../shared/navigation-tools.component';
import { ExploreComponent } from '../explore/explore.component';
import { MapPhotoViewerComponent } from '../../shared/map-photo-viewer.component';
import { MapsService } from '../../core/maps.service';
import { MobileUiService } from '../../core/mobile-ui.service';
import { MobileSheetDirective } from '../../shared/mobile-sheet.directive';
import { MobileSearchComponent } from '../../shared/mobile-search.component';

@Component({
  selector: 'app-workspace',
  imports: [MobileSearchComponent, MobileSheetDirective, DecimalPipe, MapPhotoViewerComponent, ExploreComponent, RouterOutlet, MapComponent, IconComponent, NavigationToolsComponent],
  templateUrl: './workspace.component.html',
  styleUrls: ['./workspace.component.scss', '../../../styles/workspace.scss', '../../../styles/workspace-split.scss', '../../../styles/workspace-registration.scss', '../../../styles/workspace-picking.scss'],
  encapsulation: ViewEncapsulation.None
})
export class WorkspaceComponent implements OnInit {
  readonly state = inject(ExplorationState);
  readonly maps = inject(MapsService);
  readonly navigation = inject(NavigationService);
  readonly mobileUi = inject(MobileUiService);
  readonly areaMoved = signal(false);
  readonly visibleMapBathrooms = computed(() => {
    const bathrooms = this.registration()?.bathrooms ?? this.state.mapBathrooms();
    return this.mobileUi.mobile() && this.navigation.active() ? bathrooms.filter((bathroom) => bathroom.id === this.state.selected()?.id) : bathrooms;
  });
  readonly urgentBusy = signal(false);
  readonly urgentError = signal('');
  private readonly api = inject(ApiService);
  readonly navigationBottomInset = signal(0);
  readonly registration = signal<RegisterComponent | null>(null);
  activatePanel(component: unknown, path: string | undefined): void {
    if (path !== 'cadastrar') return;
    this.registration.set(component as RegisterComponent);
    this.navigation.stop();
    this.state.enter('registration');
  }
  deactivatePanel(component: unknown): void {
    if (this.registration() === component) this.registration.set(null);
  }
  movePoint(point: Location): void {
    const registration = this.registration();
    if (registration) registration.moved(point);
    else this.state.chooseRouteOrigin(point);
  }
  locate(): void {
    const registration = this.registration();
    if (registration) void registration.locate();
    else void this.state.locate();
  }
  private wasViewingPhoto = false;
  private beforePhotoCollapsed = false;
  private wasNavigating = false;
  private wasPickingOrigin = false;
  private previousPanelCollapsed = false;
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  @ViewChild('panel') panel?: ElementRef<HTMLElement>;
  private currentUrl = this.router.url;
  private needsFocus = false;
  constructor() {
    effect(() => {
      const viewing = !!this.state.photoView();
      if (viewing && !this.wasViewingPhoto) {
        this.beforePhotoCollapsed = this.state.collapsed();
        if (window.matchMedia('(max-width: ' + getComputedStyle(document.documentElement).getPropertyValue('--breakpoint-mobile').trim() + ')').matches) this.state.collapsed.set(true);
      } else if (!viewing && this.wasViewingPhoto) this.state.collapsed.set(this.beforePhotoCollapsed);
      this.wasViewingPhoto = viewing;
    });
    effect(() => {
      this.state.panelReady();
      this.restorePanel();
    });
    effect(() => {
      const active = this.navigation.active() || this.state.originPicking();
      if (active && !this.wasNavigating) {
        this.previousPanelCollapsed = this.state.collapsed();
        if (this.navigation.active() || window.matchMedia('(max-width: ' + getComputedStyle(document.documentElement).getPropertyValue('--breakpoint-mobile').trim() + ')').matches) this.state.collapsed.set(true);
      } else if (!active && this.wasNavigating) this.state.collapsed.set(this.previousPanelCollapsed);
      this.wasNavigating = active;
    });
    effect(() => {
      const picking = this.state.originPicking();
      if (picking || this.wasPickingOrigin)
        requestAnimationFrame(() => {
          if (this.destroyRef.destroyed || (!picking && document.activeElement instanceof HTMLInputElement)) return;
          const target = picking ? document.querySelector<HTMLElement>('.route-picking-tools button') : this.panel?.nativeElement.querySelector<HTMLElement>('h1');
          if (target?.tagName === 'H1') target.tabIndex = -1;
          target?.focus({ preventScroll: true });
        });
      this.wasPickingOrigin = picking;
    });
    this.destroyRef.onDestroy(() => {
      this.navigation.stop();
      this.state.closePhoto();
    });
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationStart && this.panel) {
        const list = this.panel.nativeElement.querySelector<HTMLElement>('.result-list');
        if (list && this.state.scene() !== 'registration' && (!this.mobileUi.mobile() || this.state.scene() === 'search')) this.state.panelScrolls.set('/', list.scrollTop);
        if (this.currentUrl !== '/') this.state.panelScrolls.set(this.currentUrl, this.scrollContainer().scrollTop);
        if (event.navigationTrigger === 'imperative' && /^\/banheiros\/[^/]+$/.test(event.url) && event.url !== this.currentUrl) this.state.panelScrolls.delete(event.url);
      }
      if (event instanceof NavigationEnd) {
        this.currentUrl = event.urlAfterRedirects;
        this.needsFocus = true;
        this.restorePanel();
      }
    });
  }
  private scrollContainer(): HTMLElement {
    const panel = this.panel!.nativeElement;
    return panel.querySelector<HTMLElement>(this.currentUrl === '/' ? '.result-list' : '.workspace-content') || panel;
  }
  private restorePanel(): void {
    requestAnimationFrame(() => {
      if (this.destroyRef.destroyed || !this.panel) return;
      const panel = this.panel.nativeElement;
      this.scrollContainer().scrollTop = this.state.panelScrolls.get(this.currentUrl) || 0;
      if (this.needsFocus) {
        const focus = this.currentUrl === '/' ? panel.querySelector<HTMLElement>('a[href="/banheiros/' + this.state.lastSelected + '"]') : panel.querySelector<HTMLElement>('h1');
        if (focus) {
          if (focus.tagName === 'H1') focus.tabIndex = -1;
          focus.focus({ preventScroll: true });
          this.needsFocus = false;
        }
      }
    });
  }
  async ngOnInit(): Promise<void> {
    if (!this.state.loaded) await this.state.search();
    await this.state.restoreLocation();
  }
  open(id: string): void {
    const registration = this.registration();
    if (registration) registration.selectExisting(id);
    else void this.router.navigate(['/banheiros', id]);
  }
  async searchArea(): Promise<void> {
    await this.state.search(true);
    this.areaMoved.set(false);
    this.mobileUi.sheet.set(1);
  }
  async urgent(): Promise<void> {
    if (this.urgentBusy()) return;
    this.urgentBusy.set(true);
    this.urgentError.set('');
    const originalUrl = this.router.url;
    const current = () => !this.destroyRef.destroyed && this.router.url === originalUrl && this.state.scene() === 'search';
    try {
      const position = await this.maps.location();
      if (!current()) return;
      const bathrooms = await this.api.get<Bathroom[]>('/bathrooms');
      if (!current()) return;
      const nearest = bathrooms.filter((bathroom) => validPoint({ lat: bathroom.latitude, lng: bathroom.longitude })).sort((left, right) => distanceMeters(position, { lat: left.latitude, lng: left.longitude }) - distanceMeters(position, { lat: right.latitude, lng: right.longitude }))[0];
      if (!nearest) throw new Error('Nenhum banheiro disponível para iniciar a navegação.');
      const route = await this.maps.directions(position, { lat: nearest.latitude, lng: nearest.longitude }, 'drive');
      if (!current()) return;
      this.state.position.set(position);
      this.state.routeDrafts.set(nearest.id, { origin: 'Minha localização', position, mode: 'drive', route, startNavigation: true });
      await this.router.navigate(['/banheiros', nearest.id, 'rota']);
    } catch (error) {
      if (current()) this.urgentError.set(this.api.error(error));
    } finally {
      this.urgentBusy.set(false);
    }
  }
}
