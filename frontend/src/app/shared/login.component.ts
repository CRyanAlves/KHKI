import { ChangeDetectorRef, Component, DestroyRef, ElementRef, HostListener, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ThemeService } from '../core/theme.service';
import { AuthService } from '../core/auth.service';
import { ApiService } from '../core/api.service';
import { IconComponent } from './icon.component';
import { DialogFocusDirective } from './dialog-focus.directive';

@Component({ selector: 'app-login', imports: [FormsModule, IconComponent, DialogFocusDirective], templateUrl: './login.component.html' })
export class LoginComponent {
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly media = window.matchMedia('(max-width: ' + getComputedStyle(document.documentElement).getPropertyValue('--breakpoint-mobile').trim() + ')');
  private viewportWidth = window.innerWidth;
  private fullHeight = window.visualViewport?.height || window.innerHeight;
  private frame = 0;
  readonly viewportHeight = signal(this.fullHeight);
  readonly viewportTop = signal(window.visualViewport?.offsetTop || 0);
  readonly compact = signal(false);
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  private readonly api = inject(ApiService);
  register = false;
  visible = false;
  name = '';
  email = '';
  password = '';
  rememberMe = false;
  error = '';
  busy = false;
  attempted = false;
  get mobile(): boolean {
    return this.media.matches;
  }
  constructor() {
    const update = () => {
      cancelAnimationFrame(this.frame);
      this.frame = requestAnimationFrame(() => this.updateViewport());
    };
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    this.media.addEventListener('change', update);
    this.updateViewport();
    this.destroyRef.onDestroy(() => {
      cancelAnimationFrame(this.frame);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      this.media.removeEventListener('change', update);
    });
  }
  private updateViewport(): void {
    const viewport = window.visualViewport;
    const height = viewport?.height || window.innerHeight;
    if (this.viewportWidth !== window.innerWidth) {
      this.viewportWidth = window.innerWidth;
      this.fullHeight = Math.max(height, window.innerHeight);
    }
    this.fullHeight = Math.max(this.fullHeight, height, window.innerHeight);
    const threshold = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mobile-login-keyboard-threshold')) || 160;
    this.compact.set(this.mobile && (viewport?.scale || 1) === 1 && this.fullHeight - height > threshold);
    this.viewportHeight.set(height);
    this.viewportTop.set(viewport?.offsetTop || 0);
    if (this.compact()) this.keepFieldVisible();
  }
  @HostListener('focusin') keepFieldVisible(): void {
    if (!this.mobile || !this.compact()) return;
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active instanceof HTMLInputElement && this.element.nativeElement.contains(active)) active.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    });
  }
  advanceToPassword(event: Event): void {
    event.preventDefault();
    this.element.nativeElement.querySelector<HTMLInputElement>('#login-password')?.focus();
  }
  switchMode(): void {
    if (this.busy) return;
    this.register = !this.register;
    this.error = '';
    this.attempted = false;
  }
  close(): void {
    if (!this.busy) this.auth.opened.set(false);
  }
  async submit(form: NgForm): Promise<void> {
    if (this.busy) return;
    this.attempted = true;
    if (form.invalid) {
      form.control.markAllAsTouched();
      this.element.nativeElement.querySelector<HTMLInputElement>('input.ng-invalid')?.focus();
      return;
    }
    this.busy = true;
    this.error = '';
    try {
      if (this.register) await this.auth.register(this.name, this.email, this.password);
      else await this.auth.login(this.email, this.password, this.rememberMe);
    } catch (error) {
      this.error = this.api.error(error);
    } finally {
      this.changeDetector.markForCheck();
      this.busy = false;
    }
  }
}
