import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ExplorationState } from '../features/workspace/exploration-state.service';
import { NavigationService } from './navigation.service';

@Injectable({ providedIn: 'root' })
export class MobileUiService {
  private readonly router = inject(Router);
  private readonly state = inject(ExplorationState);
  readonly navigation = inject(NavigationService);
  private readonly media = window.matchMedia('(max-width: ' + getComputedStyle(document.documentElement).getPropertyValue('--breakpoint-mobile').trim() + ')');
  readonly mobile = signal(this.media.matches);
  readonly url = signal(this.router.url);
  readonly searchOpen = signal(false);
  readonly accountOpen = signal(false);
  readonly accountTrigger = signal<HTMLElement | null>(null);
  readonly sheet = signal(0);
  readonly drag = signal<number | null>(null);
  readonly viewportHeight = signal(window.visualViewport?.height || window.innerHeight);
  readonly detailsMinimumHeight = signal(0);
  readonly detailsExpandedHeight = signal(0);
  get stops(): number[] {
    const stops = ['--mobile-sheet-peek', '--mobile-sheet-half', '--mobile-sheet-full'].map((token) => Number(getComputedStyle(document.documentElement).getPropertyValue(token)));
    if (this.mobile() && this.state.scene() === 'details') {
      if (this.detailsMinimumHeight() > 0) stops[0] = this.detailsMinimumHeight() / this.viewportHeight();
      stops[1] = Math.max(stops[1], stops[0]);
    }
    return stops;
  }
  readonly fraction = computed(() => {
    this.mobile();
    return this.drag() ?? this.stops[this.sheet()];
  });
  readonly detailsSheetHeight = computed(() => Math.max(this.detailsMinimumHeight(), this.fraction() * this.viewportHeight()));
  readonly detailsCompact = computed(() => {
    if (!this.mobile() || this.state.scene() !== 'details') return false;
    if (this.drag() === null && this.sheet() === 2) return false;
    return (this.drag() === null && this.sheet() === 0) || this.detailsSheetHeight() < this.detailsExpandedHeight();
  });
  readonly navbar = computed(() => this.mobile() && !this.searchOpen() && !this.state.photoView() && !this.navigation.active() && (this.url().split('?')[0] === '/' || this.url().startsWith('/contribuicoes')));
  readonly immersive = computed(() => this.mobile() && (!!this.state.photoView() || this.navigation.active()));
  readonly accountShortcut = computed(() => this.mobile() && !this.immersive() && !/^\/(?:banheiros\/[^/]+)?$/.test(this.url().split('?')[0]));
  suppressClickUntil = 0;
  private searchSheet = 0;
  private previousScene = 'search';
  constructor() {
    const destroy = inject(DestroyRef);
    const resize = () => {
      this.mobile.set(this.media.matches);
      this.viewportHeight.set(window.visualViewport?.height || window.innerHeight);
    };
    this.media.addEventListener('change', resize);
    window.visualViewport?.addEventListener('resize', resize);
    window.addEventListener('resize', resize);
    destroy.onDestroy(() => {
      this.media.removeEventListener('change', resize);
      window.visualViewport?.removeEventListener('resize', resize);
      window.removeEventListener('resize', resize);
    });
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.url.set(event.urlAfterRedirects);
        this.searchOpen.set(false);
        this.accountOpen.set(false);
      }
    });
    effect(() => {
      const scene = this.state.scene();
      if (!this.mobile()) return;
      if (scene !== this.previousScene) {
        if (this.previousScene === 'search') this.searchSheet = this.sheet();
        this.sheet.set(scene === 'search' ? this.searchSheet : scene === 'registration' || scene === 'review' || scene === 'photos' ? 2 : 1);
        this.drag.set(null);
        this.previousScene = scene;
      }
    });
    effect(() => {
      const root = document.documentElement;
      root.classList.toggle('mobile-ui', this.mobile());
      root.classList.toggle('mobile-immersive', this.immersive());
      root.classList.toggle('mobile-navbar-visible', this.navbar());
      root.classList.toggle('mobile-route-active', this.mobile() && this.navigation.active());
      root.style.setProperty('--mobile-viewport-height', this.viewportHeight() + 'px');
    });
  }
  toggleAccount(trigger: HTMLElement): void {
    this.accountTrigger.set(trigger);
    this.accountOpen.update((open) => !open);
  }
  cycle(): void {
    if (Date.now() < this.suppressClickUntil) return;
    this.sheet.update((value) => (value === 2 ? 0 : value + 1));
  }
  settle(fraction: number, delta: number, maximum = this.stops[2]): void {
    const stops = [this.stops[0], Math.min(this.stops[1], maximum), maximum];
    const nearest = stops.reduce((best, stop, index) => (Math.abs(stop - fraction) < Math.abs(stops[best] - fraction) ? index : best), 0);
    this.sheet.set(Math.abs(delta) > 0.07 && nearest === this.sheet() ? Math.max(0, Math.min(2, this.sheet() + (delta > 0 ? 1 : -1))) : nearest);
    this.drag.set(null);
    this.suppressClickUntil = Date.now() + 300;
  }
}
