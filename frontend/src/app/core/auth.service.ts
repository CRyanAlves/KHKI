import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from './api.service';
import { User } from './models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  readonly user = signal<User | null>(null);
  readonly opened = signal(false);
  returnUrl = '';
  ready = this.initialize();
  private async initialize(): Promise<void> {
    try {
      await this.api.get('/auth/csrf');
      this.user.set(await this.api.get<User>('/auth/me'));
    } catch {
      this.user.set(null);
    }
  }
  require(url: string): boolean {
    if (this.user()) return true;
    this.returnUrl = url;
    this.opened.set(true);
    return false;
  }
  async login(email: string, password: string): Promise<void> {
    await this.api.get('/auth/csrf');
    this.user.set(await this.api.post<User>('/auth/login', { email, password }));
    await this.api.get('/auth/csrf');
    this.opened.set(false);
    if (this.returnUrl) {
      const url = this.returnUrl;
      this.returnUrl = '';
      await this.router.navigateByUrl(url);
    }
  }
  async register(name: string, email: string, password: string): Promise<void> {
    await this.api.get('/auth/csrf');
    await this.api.post('/auth/register', { name, email, password });
    await this.login(email, password);
  }
  async logout(): Promise<void> {
    await this.api.post('/auth/logout', {});
    this.user.set(null);
    await this.api.get('/auth/csrf');
    await this.router.navigateByUrl('/');
  }
}
