import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ExplorationState } from '../workspace/exploration-state.service';
import { BathroomCardComponent } from '../../shared/bathroom-card.component';
import { IconComponent } from '../../shared/icon.component';
import { MobileUiService } from '../../core/mobile-ui.service';

import { SkeletonComponent } from '../../shared/skeleton.component';

@Component({ selector: 'app-explore', imports: [SkeletonComponent, FormsModule, BathroomCardComponent, IconComponent], templateUrl: './explore.component.html', styleUrl: './explore.component.scss', host: { class: 'explore-view' } })
export class ExploreComponent implements OnInit {
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
