import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { ApiService } from './api.service';
import { User } from './models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  readonly user = signal<User | null>(null);
  readonly opened = signal(false);
  readonly status = signal<'checking' | 'authenticated' | 'guest' | 'unavailable'>('checking');
  readonly sessionError = signal('');
  returnUrl = '';
  private restoring?: Promise<boolean>;
  private revision = 0;
  readonly ready: Promise<void>;
  constructor() {
    this.api.authenticationExpired.pipe(takeUntilDestroyed()).subscribe(() => {
      this.revision++;
      this.user.set(null);
      this.status.set('guest');
      this.sessionError.set('Sua sessão expirou. Entre novamente para continuar.');
    });
    const online = () => { if (this.status() === 'unavailable') void this.retrySession(); };
    window.addEventListener('online', online);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('online', online));
    this.ready = this.restoreSession().then(() => {});
  }
  restoreSession(): Promise<boolean> {
    if (this.restoring) return this.restoring;
    this.status.set('checking');
    this.restoring = this.initialize().finally(() => { this.restoring = undefined; });
    return this.restoring;
  }
  private async initialize(): Promise<boolean> {
    const revision = this.revision;
    try {
      await this.api.get('/auth/csrf');
      const user = await this.api.get<User>('/auth/me');
      this.validateUser(user);
      if (revision !== this.revision) return false;
      this.user.set(user);
      this.status.set('authenticated');
      this.sessionError.set('');
      return true;
    } catch (error) {
      if (revision !== this.revision) return false;
      if (error instanceof HttpErrorResponse && error.status === 401) {
        this.user.set(null);
        this.status.set('guest');
        this.sessionError.set('');
      } else {
        this.status.set('unavailable');
        this.sessionError.set('Não foi possível verificar sua sessão. Confira sua conexão e tente novamente.');
      }
      return false;
    }
  }
  private validateUser(user: unknown): asserts user is User {
    if (!user || typeof user !== 'object' || !('id' in user) || typeof user.id !== 'string' || !user.id || !('name' in user) || typeof user.name !== 'string' || !user.name.trim() || !('role' in user) || (user.role !== 'USER' && user.role !== 'ADMIN')) throw new Error('Não foi possível verificar os dados da conta. Tente novamente.');
  }
  async retrySession(): Promise<void> {
    const restored = await this.restoreSession();
    if (restored && this.returnUrl) await this.resumeAction();
    else if (this.status() === 'guest' && this.returnUrl) this.opened.set(true);
  }
  sessionAction(): void {
    if (this.status() === 'guest') this.opened.set(true);
    else void this.retrySession();
  }
  private async resumeAction(): Promise<void> {
    if (this.returnUrl) {
      const url = this.returnUrl;
      this.returnUrl = '';
      await this.router.navigateByUrl(url);
    }
  }
  require(url: string): boolean {
    if (this.user()) return true;
    this.returnUrl = url;
    if (this.status() !== 'guest') {
      this.sessionError.set('Ainda não foi possível verificar sua sessão. Tente novamente antes de continuar.');
      return false;
    }
    this.opened.set(true);
    return false;
  }
  async login(email: string, password: string, rememberMe = false): Promise<void> {
    await this.api.get('/auth/csrf');
    const user = await this.api.post<User>('/auth/login', { email, password, rememberMe });
    this.validateUser(user);
    this.revision++;
    this.user.set(user);
    this.status.set('authenticated');
    this.sessionError.set('');
    try { await this.api.get('/auth/csrf'); } catch { this.sessionError.set('Você entrou, mas a conexão foi interrompida. Tente verificar a sessão novamente.'); }
    this.opened.set(false);
    await this.resumeAction();
  }
  async register(name: string, email: string, password: string): Promise<void> {
    await this.api.get('/auth/csrf');
    await this.api.post('/auth/register', { name, email, password });
    await this.login(email, password);
  }
  async logout(): Promise<void> {
    await this.api.get('/auth/csrf');
    await this.api.post('/auth/logout', {});
    this.revision++;
    this.user.set(null);
    this.status.set('guest');
    this.sessionError.set('');
    this.returnUrl = '';
    await this.router.navigateByUrl('/');
  }
}
