import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly preference = window.matchMedia('(prefers-color-scheme: dark)');
  private readonly current = signal<Theme>(document.documentElement.dataset['theme'] === 'dark' ? 'dark' : 'light');
  readonly mode = this.current.asReadonly();
  constructor() {
    this.preference.addEventListener('change', () => {
      if (!this.saved()) this.apply(this.preference.matches ? 'dark' : 'light');
    });
    window.addEventListener('storage', (event) => {
      if (event.key === 'khki-theme' || event.key === null) this.apply(this.saved() || (this.preference.matches ? 'dark' : 'light'));
    });
  }
  toggle(): void {
    const next = this.mode() === 'dark' ? 'light' : 'dark';
    this.apply(next);
    try {
      localStorage.setItem('khki-theme', next);
    } catch {}
  }
  private saved(): Theme | null {
    try {
      const value = localStorage.getItem('khki-theme');
      return value === 'light' || value === 'dark' ? value : null;
    } catch {
      return null;
    }
  }
  private apply(theme: Theme): void {
    document.documentElement.dataset['theme'] = theme;
    this.current.set(theme);
  }
}
