import { Component, inject, signal } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationSkipped, NavigationStart, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ThemeService } from './core/theme.service';
import { AuthService } from './core/auth.service';
import { ApiService } from './core/api.service';
import { IconComponent } from './shared/icon.component';
import { LoginComponent } from './shared/login.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SkeletonComponent, SkeletonVariant } from './shared/skeleton.component';
import { MobileUiService } from './core/mobile-ui.service';
import { MobileAccountComponent } from './shared/mobile-account.component';
import { AccountAvatarComponent } from './shared/account-avatar.component';
import { ExploreFilterPanelComponent } from './features/explore/explore-filter-panel.component';
import { ConfirmationComponent } from './shared/confirmation.component';
import { MobileNavMotionDirective } from './shared/mobile-nav-motion.directive';

@Component({ selector: 'app-root', imports: [MobileNavMotionDirective, ExploreFilterPanelComponent, ConfirmationComponent, MobileAccountComponent, AccountAvatarComponent, SkeletonComponent, RouterOutlet, RouterLink, RouterLinkActive, IconComponent, LoginComponent], templateUrl: './app.html', styleUrl: './app.scss' })
export class App {
  readonly navigation = [
    { path: '/', label: 'Explorar', icon: 'Search' },
    { path: '/cadastrar', label: 'Cadastrar banheiro', icon: 'Plus' }
  ];
  readonly router = inject(Router);
  readonly theme = inject(ThemeService);
  readonly auth = inject(AuthService);
  readonly mobileUi = inject(MobileUiService);
  private readonly api = inject(ApiService);
  menu = false;
  error = '';
  readonly navigationLoading = signal(false);
  navigationTarget = '';
  pageSkeleton: SkeletonVariant = 'form';
  constructor() {
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.navigationTarget = event.url;
        this.pageSkeleton = event.url.startsWith('/admin') || event.url.startsWith('/contribuicoes') ? 'rows' : event.url === '/' ? 'cards' : 'form';
        this.navigationLoading.set(true);
      } else if (event instanceof NavigationEnd || event instanceof NavigationCancel || event instanceof NavigationError || event instanceof NavigationSkipped) this.navigationLoading.set(false);
    });
  }
  isNavigationActive(path: string): boolean {
    return this.router.url === path || this.router.url.startsWith(path === '/' ? '/banheiros/' : path + '/');
  }
  async logout(): Promise<void> {
    try {
      await this.auth.logout();
      this.menu = false;
    } catch (error) {
      this.error = this.api.error(error);
    }
  }
}
