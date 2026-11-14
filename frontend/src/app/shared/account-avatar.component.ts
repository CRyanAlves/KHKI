import { Component, computed, inject } from '@angular/core';
import { AuthService } from '../core/auth.service';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-account-avatar',
  imports: [IconComponent],
  template: `@if (initials(); as value) {
      <span class="account-initials" aria-hidden="true">{{ value }}</span>
    } @else {
      <app-icon name="User" [size]="22" />
    }`,
  styleUrl: './account-avatar.component.scss'
})
export class AccountAvatarComponent {
  private readonly auth = inject(AuthService);
  readonly initials = computed(() => {
    const words = this.auth.user()?.name.trim().split(/\s+/u).filter(Boolean) || [];
    return words.length ? (Array.from(words[0])[0] + (words.length > 1 ? Array.from(words[words.length - 1])[0] : '')).toLocaleUpperCase('pt-BR') : '';
  });
}
