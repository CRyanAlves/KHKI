import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ExplorationState } from '../../../../../layout/exploration-workspace/exploration-state.service';
import { BathroomSearchResultCardComponent } from './bathroom-search-result-card.component';
import { BathroomSearchFiltersBarComponent } from '../filters/bathroom-search-filters-bar.component';
import { IconComponent } from '../../../../../shared/ui/icon/icon.component';
import { MobileUiService } from '../../../../../layout/mobile/mobile-ui.service';

import { SkeletonComponent } from '../../../../../shared/ui/skeleton/skeleton.component';

@Component({ selector: 'app-explore', imports: [BathroomSearchFiltersBarComponent, SkeletonComponent, FormsModule, BathroomSearchResultCardComponent, IconComponent], templateUrl: './bathroom-search-results.component.html', styleUrl: './bathroom-search-results.component.scss', host: { class: 'explore-view' } })
export class BathroomSearchResultsComponent implements OnInit {
  readonly state = inject(ExplorationState);
  readonly mobileUi = inject(MobileUiService);
  clearSearch(): void {
    this.state.query = '';
    void this.state.search();
  }
  ngOnInit(): void {
    this.state.panelReady.update((value) => value + 1);
  }
}
