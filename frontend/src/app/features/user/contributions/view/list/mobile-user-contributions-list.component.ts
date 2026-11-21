import { filterUserContributions } from '../../service/user-contributions-filtering';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Contribution, STATUS_LABELS, Status, TargetType } from '../../../../../domain/moderation/moderation.model';
import { ThemeService } from '../../../../../core/preferences/theme.service';
import { IconComponent } from '../../../../../shared/ui/icon/icon.component';
import { SkeletonComponent } from '../../../../../shared/ui/skeleton/skeleton.component';

@Component({ selector: 'app-mobile-contributions', imports: [DatePipe, RouterLink, IconComponent, SkeletonComponent], templateUrl: './mobile-user-contributions-list.component.html', styleUrl: './mobile-user-contributions-list.component.scss' })
export class MobileUserContributionsListComponent {
  readonly theme = inject(ThemeService);
  readonly items = input<Contribution[]>([]);
  readonly loading = input(false);
  readonly error = input('');
  readonly retry = output<void>();
  readonly type = signal<TargetType | ''>('');
  readonly status = signal<Status | ''>('');
  readonly order = signal('newest');
  readonly expanded = signal<ReadonlySet<string>>(new Set());
  readonly types = [
    { value: '', label: 'Tudo' },
    { value: 'BATHROOM', label: 'Banheiros' },
    { value: 'REVIEW', label: 'Avaliações' }
  ] as const;
  readonly statuses = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label: value === 'REJECTED' ? 'Não aprovado' : label }));
  readonly rows = computed(() => filterUserContributions(this.items(), this.type(), this.status(), this.order()));
  setStatus(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value === '' || Object.hasOwn(STATUS_LABELS, value)) this.status.set(value as Status | '');
  }
  setOrder(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value === 'oldest' || value === 'newest') this.order.set(value);
  }
  clear(): void {
    this.type.set('');
    this.status.set('');
  }
  toggle(id: string): void {
    const next = new Set(this.expanded());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.expanded.set(next);
  }
}
