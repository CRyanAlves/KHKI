import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ExplorationState } from '../workspace/exploration-state.service';
import { BathroomCardComponent } from '../../shared/bathroom-card.component';
import { IconComponent } from '../../shared/icon.component';

import { SkeletonComponent } from '../../shared/skeleton.component';

@Component({ selector: 'app-explore', imports: [SkeletonComponent, FormsModule, BathroomCardComponent, IconComponent], templateUrl: './explore.component.html' })
export class ExploreComponent implements OnInit {
  readonly state = inject(ExplorationState);
  ngOnInit(): void {
    this.state.enter('search');
    this.state.panelReady.update((value) => value + 1);
  }
}
