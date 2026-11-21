import { Component, computed, inject, input } from '@angular/core';
import { ExplorationState } from '../../../../../layout/exploration-workspace/exploration-state.service';
import { MobileUiService } from '../../../../../layout/mobile/mobile-ui.service';
import { ITEM_LABELS } from '../../../../../domain/bathrooms/bathroom.model';
import { OBSERVED_ACCESSIBILITY } from '../../../../../domain/bathrooms/bathroom-details';
import { validPoint } from '../../../../../shared/geo/navigation-geometry';
import { DialogFocusDirective } from '../../../../../shared/directives/dialog-focus.directive';
import { IconComponent } from '../../../../../shared/ui/icon/icon.component';

@Component({ selector: 'app-explore-filter-panel', imports: [DialogFocusDirective, IconComponent], templateUrl: './bathroom-search-filters-panel.component.html', styleUrl: './bathroom-search-filters-panel.component.scss' })
export class BathroomSearchFiltersPanelComponent {
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
