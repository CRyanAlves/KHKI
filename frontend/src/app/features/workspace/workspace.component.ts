import { Component, DestroyRef, ElementRef, OnInit, ViewChild, ViewEncapsulation, effect, inject, signal } from '@angular/core';
import { NavigationEnd, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ExplorationState } from './exploration-state.service';
import { MapComponent } from '../../shared/map.component';
import { IconComponent } from '../../shared/icon.component';
import { NavigationService } from '../../core/navigation.service';
import { NavigationToolsComponent } from '../../shared/navigation-tools.component';
import { MapsService } from '../../core/maps.service';

@Component({ selector: 'app-workspace', imports: [RouterOutlet, MapComponent, IconComponent, NavigationToolsComponent], templateUrl: './workspace.component.html', styleUrls: ['./workspace.component.scss', '../../../styles/workspace.scss'], encapsulation: ViewEncapsulation.None })
export class WorkspaceComponent implements OnInit {
  readonly state = inject(ExplorationState);
  readonly maps = inject(MapsService);
  readonly navigation = inject(NavigationService);
  readonly navigationBottomInset = signal(0);
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
      this.state.panelReady();
      this.restorePanel();
    });
    effect(() => {
      const active = this.navigation.active() || this.state.originPicking();
      if (active && !this.wasNavigating) {
        this.previousPanelCollapsed = this.state.collapsed();
        if (window.matchMedia('(max-width: ' + getComputedStyle(document.documentElement).getPropertyValue('--breakpoint-mobile').trim() + ')').matches) this.state.collapsed.set(true);
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
    this.destroyRef.onDestroy(() => this.navigation.stop());
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationStart && this.panel) this.state.panelScrolls.set(this.currentUrl, this.panel.nativeElement.scrollTop);
      if (event instanceof NavigationEnd) {
        this.currentUrl = event.urlAfterRedirects;
        this.needsFocus = true;
        this.restorePanel();
      }
    });
  }
  private restorePanel(): void {
    requestAnimationFrame(() => {
      if (this.destroyRef.destroyed || !this.panel) return;
      const panel = this.panel.nativeElement;
      panel.scrollTop = this.state.panelScrolls.get(this.currentUrl) || 0;
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
    void this.router.navigate(['/banheiros', id]);
  }
  async searchArea(): Promise<void> {
    await this.router.navigate(['/']);
    await this.state.search(true);
  }
}
