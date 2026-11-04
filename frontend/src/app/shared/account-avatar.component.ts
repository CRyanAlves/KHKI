import { Component, computed, inject } from '@angular/core';
import { AuthService } from '../core/auth.service';
import { IconComponent } from './icon.component';

@Component({ selector: 'app-account-avatar', imports: [IconComponent], template: `@if (initials(); as value) { <span class="account-initials" aria-hidden="true">{{ value }}</span> } @else { <app-icon name="User" [size]="22" /> }`, styles: `:host { display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); place-items: center; width: 100%; height: 100%; border-radius: inherit; } .account-initials { display: grid; place-items: center; width: 100%; height: 100%; border: var(--border-width) solid var(--color-accent); border-radius: inherit; background: var(--color-accent-soft); color: var(--color-text); font-size: var(--text-sm); font-weight: var(--weight-bold); }` })
export class AccountAvatarComponent {
  private readonly auth = inject(AuthService);
  readonly initials = computed(() => {
    const words = this.auth.user()?.name.trim().split(/\s+/u).filter(Boolean) || [];
    return words.length ? (Array.from(words[0])[0] + (words.length > 1 ? Array.from(words[words.length - 1])[0] : '')).toLocaleUpperCase('pt-BR') : '';
  });
}
