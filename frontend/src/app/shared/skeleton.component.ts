import { Component, Input } from '@angular/core';

export type SkeletonVariant = 'cards' | 'rows' | 'detail' | 'form' | 'route' | 'compact' | 'map';

@Component({ selector: 'app-skeleton', templateUrl: './skeleton.component.html', host: { class: 'loading-skeleton', role: 'status', 'aria-live': 'polite', 'aria-busy': 'true' } })
export class SkeletonComponent {
  @Input() variant: SkeletonVariant = 'cards';
  @Input() label = 'Carregando conteúdo…';
  readonly rows = [0, 1, 2];
}
