import { Component, computed, inject, input } from '@angular/core';
import { ExplorationState } from '../workspace/exploration-state.service';
import { MobileUiService } from '../../core/mobile-ui.service';
import { ITEM_LABELS } from '../../core/models';
import { OBSERVED_ACCESSIBILITY } from '../../core/bathroom-details';
import { validPoint } from '../../core/navigation-geometry';
import { DialogFocusDirective } from '../../shared/dialog-focus.directive';
import { IconComponent } from '../../shared/icon.component';

@Component({ selector: 'app-explore-filter-panel', imports: [DialogFocusDirective, IconComponent], templateUrl: './explore-filter-panel.component.html', styleUrl: './explore-filter-panel.component.scss' })
export class ExploreFilterPanelComponent {
  readonly state = inject(ExplorationState);
  readonly ui = inject(MobileUiService);
  readonly mobile = input(false);
  readonly referenceAvailable = computed(() => !!this.state.position() && validPoint(this.state.position()!));
  readonly audiences = [
    { value: '', label: 'Sem preferência' },
    { value: 'PUBLIC', label: 'Livre para todos' },
    { value: 'CUSTOMERS', label: 'Apenas clientes' },
    { value: 'AUTHORIZATION', label: 'Exige autorização' },
    { value: 'OTHER', label: 'Outra condição' }
  ] as const;
  readonly charges = [
    { value: '', label: 'Sem preferência' },
    { value: 'NO', label: 'Gratuito' },
    { value: 'YES', label: 'Pago' }
  ] as const;
  readonly resources = OBSERVED_ACCESSIBILITY;
  readonly items = Object.entries(ITEM_LABELS);
  readonly distances = [
    { value: 0, label: 'Sem limite' },
    { value: 500, label: '500 m' },
    { value: 1000, label: '1 km' },
    { value: 3000, label: '3 km' }
  ] as const;
}
