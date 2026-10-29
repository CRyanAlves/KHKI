import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ThemeService } from './core/theme.service';
import { AuthService } from './core/auth.service';
import { ApiService } from './core/api.service';
import { IconComponent } from './shared/icon.component';
import { LoginComponent } from './shared/login.component';
@Component({ selector: 'app-root', imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent, LoginComponent], templateUrl: './app.html', styleUrl: './app.scss' })
export class App {
  readonly navigation = [{ path: '/', label: 'Explorar', icon: 'Search' }, { path: '/cadastrar', label: 'Cadastrar banheiro', icon: 'Plus' }];
  readonly router = inject(Router);
  readonly theme = inject(ThemeService); readonly auth = inject(AuthService); private readonly api = inject(ApiService); menu = false; error = '';
  isNavigationActive(path: string): boolean { return this.router.url === path || this.router.url.startsWith(path === '/' ? '/banheiros/' : path + '/'); }
  async logout(): Promise<void> { try { await this.auth.logout(); this.menu = false; } catch (error) { this.error = this.api.error(error); } }
}