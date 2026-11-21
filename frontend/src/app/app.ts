import { apiError } from './core/http/api-error';
import { Component, inject, signal } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationSkipped, NavigationStart, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ThemeService } from './core/preferences/theme.service';
import { AuthService } from './core/session/auth.service';
import { IconComponent } from './shared/ui/icon/icon.component';
import { AuthenticationPanelComponent } from './layout/authentication-panel/authentication-panel.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SkeletonComponent, SkeletonVariant } from './shared/ui/skeleton/skeleton.component';
import { MobileUiService } from './layout/mobile/mobile-ui.service';
import { MobileAccountPopoverComponent } from './features/user/account-menu/view/mobile-account-popover.component';
import { AccountAvatarComponent } from './shared/ui/account-avatar/account-avatar.component';
import { BathroomSearchFiltersPanelComponent } from './features/bathroom/search/view/filters/bathroom-search-filters-panel.component';
import { ConfirmationComponent } from './shared/ui/confirmation/confirmation.component';
import { MobileNavMotionDirective } from './layout/mobile-navbar/mobile-nav-motion.directive';

@Component({ selector: 'app-root', imports: [MobileNavMotionDirective, BathroomSearchFiltersPanelComponent, ConfirmationComponent, MobileAccountPopoverComponent, AccountAvatarComponent, SkeletonComponent, RouterOutlet, RouterLink, RouterLinkActive, IconComponent, AuthenticationPanelComponent], templateUrl: './app.html', styleUrl: './app.scss' })
export class App {
  readonly navigation = [
    { path: '/', label: 'Explorar', icon: 'Search' },
    { path: '/cadastrar', label: 'Cadastrar banheiro', icon: 'Plus' }
  ];
  readonly router = inject(Router);
  readonly theme = inject(ThemeService);
  readonly auth = inject(AuthService);
  readonly mobileUi = inject(MobileUiService);
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
      this.error = apiError(error);
    }
  }
}
