import { Component, DestroyRef, EventEmitter, Output, afterNextRender, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { MobileUiService } from '../core/mobile-ui.service';
import { ThemeService } from '../core/theme.service';
import { AccountAvatarComponent } from './account-avatar.component';
import { DialogFocusDirective } from './dialog-focus.directive';
import { IconComponent } from './icon.component';

@Component({ selector: 'app-mobile-account', imports: [RouterLink, AccountAvatarComponent, DialogFocusDirective, IconComponent], templateUrl: './mobile-account.component.html', styleUrl: './mobile-account.component.scss' })
export class MobileAccountComponent {
  readonly auth = inject(AuthService);
  readonly ui = inject(MobileUiService);
  readonly theme = inject(ThemeService);
  private readonly destroyRef = inject(DestroyRef);
  readonly appearance = signal(false);
  readonly position = signal({ top: 0, left: 0, width: 0, availableHeight: 0, arrowLeft: 0 });
  readonly backdropClip = signal('');
  readonly themes = [
    { value: 'light', label: 'Claro', icon: 'Sun' },
    { value: 'dark', label: 'Escuro', icon: 'Moon' },
    { value: 'system', label: 'Sistema', icon: 'Monitor' }
  ] as const;
  @Output() logoutRequested = new EventEmitter<void>();
  get themeLabel(): string {
    return this.themes.find((option) => option.value === this.theme.selection())!.label;
  }
  get themeIcon(): string {
    return this.themes.find((option) => option.value === this.theme.selection())!.icon;
  }
  constructor() {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => this.measure());
    };
    const observer = new ResizeObserver(update);
    const trigger = this.ui.accountTrigger();
    if (trigger) observer.observe(trigger);
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    this.measure();
    afterNextRender(update);
    this.destroyRef.onDestroy(() => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    });
  }
  private measure(): void {
    const trigger = this.ui.accountTrigger();
    if (!trigger?.isConnected) {
      this.close();
      return;
    }
    const tokens = getComputedStyle(document.documentElement);
    const number = (token: string) => Number.parseFloat(tokens.getPropertyValue(token)) || 0;
    const margin = number('--space-4');
    const gap = number('--space-3');
    const arrow = number('--mobile-account-arrow-size');
    const viewport = window.visualViewport;
    const viewLeft = viewport?.offsetLeft || 0;
    const viewTop = viewport?.offsetTop || 0;
    const viewWidth = viewport?.width || window.innerWidth;
    const viewHeight = viewport?.height || window.innerHeight;
    const anchor = trigger.getBoundingClientRect();
    const width = Math.min(number('--mobile-account-width'), viewWidth - margin * 2);
    const left = Math.max(viewLeft + margin, Math.min(anchor.right - width, viewLeft + viewWidth - margin - width));
    const top = Math.max(viewTop + margin, Math.min(anchor.bottom + gap, viewTop + viewHeight - margin - number('--control-size') - margin * 2));
    const arrowLeft = Math.max(margin, Math.min(anchor.x + anchor.width / 2 - left - arrow / 2, width - margin - arrow));
    this.position.set({ top, left, width, availableHeight: viewTop + viewHeight - top - margin, arrowLeft });
    const hitArea = Math.max(0, (number('--control-size') - anchor.width) / 2);
    const radius = anchor.width / 2 + hitArea;
    const centerX = anchor.left + anchor.width / 2;
    const centerY = anchor.top + anchor.height / 2;
    const opening = Array.from({ length: 33 }, (_, index) => {
      const angle = (index * Math.PI) / 16;
      return `${centerX + Math.cos(angle) * radius}px ${centerY + Math.sin(angle) * radius}px`;
    }).join(', ');
    this.backdropClip.set(`polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${opening})`);
  }
  close(): void {
    this.ui.accountOpen.set(false);
  }
  showAppearance(value: boolean): void {
    this.appearance.set(value);
    document.getElementById('mobile-account-title')?.focus({ preventScroll: true });
  }
  login(): void {
    this.close();
    this.auth.opened.set(true);
  }
  logout(): void {
    this.close();
    this.logoutRequested.emit();
  }
}
