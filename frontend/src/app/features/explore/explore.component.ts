import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ExplorationState } from '../workspace/exploration-state.service';
import { BathroomCardComponent } from '../../shared/bathroom-card.component';
import { IconComponent } from '../../shared/icon.component';

@Component({ selector: 'app-explore', imports: [FormsModule, BathroomCardComponent, IconComponent], templateUrl: './explore.component.html' })
export class ExploreComponent implements OnInit {
  readonly state = inject(ExplorationState);
  ngOnInit(): void { this.state.enter('search'); this.state.panelReady.update(value => value + 1); }
}
