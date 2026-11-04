import { Component, computed, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Contribution, STATUS_LABELS, Status, TargetType } from '../../core/models';
import { ThemeService } from '../../core/theme.service';
import { IconComponent } from '../../shared/icon.component';
import { SkeletonComponent } from '../../shared/skeleton.component';

@Component({ selector: 'app-mobile-contributions', imports: [DatePipe, RouterLink, IconComponent, SkeletonComponent], templateUrl: './mobile-contributions.component.html', styleUrl: './mobile-contributions.component.scss' })
export class MobileContributionsComponent {
  readonly theme = inject(ThemeService);
  readonly items = input<Contribution[]>([]);
  readonly loading = input(false);
  readonly error = input('');
  readonly retry = output<void>();
  readonly type = signal<TargetType | ''>('');
  readonly status = signal<Status | ''>('');
  readonly order = signal('newest');
  readonly expanded = signal<ReadonlySet<string>>(new Set());
  readonly types = [{ value: '', label: 'Tudo' }, { value: 'BATHROOM', label: 'Banheiros' }, { value: 'REVIEW', label: 'Avaliações' }, { value: 'PHOTO', label: 'Fotos' }] as const;
  readonly statuses = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label: value === 'REJECTED' ? 'Não aprovado' : label }));
  readonly rows = computed(() => this.items().filter(item => (!this.type() || item.type === this.type()) && (!this.status() || item.status === this.status())).sort((first, second) => (Date.parse(first.createdAt) - Date.parse(second.createdAt)) * (this.order() === 'oldest' ? 1 : -1)).map(item => ({ ...item, name: this.name(item), decision: this.reason(item), label: item.status === 'REJECTED' ? 'Não aprovado' : STATUS_LABELS[item.status] })));
  private readonly identifier = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/giu;
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
  private name(item: Contribution): string {
    const name = item.title.replace(/^(?:(?:foto|avaliação|cadastro|banheiro)\s*:\s*)+/iu, '').replace(this.identifier, '').trim();
    return name || 'Local relacionado ao envio';
  }
  private reason(item: Contribution): string {
    const reason = (item.reason || '').replace(this.identifier, '').replace(/\s+([.,;:])/gu, '$1').replace(/\s+/gu, ' ').trim();
    if (item.status === 'APPROVED' && /^(?:cadastro|foto|avaliação)?\s*aprova(?:do|da)\.?$/iu.test(reason)) return '';
    return reason;
  }
}
