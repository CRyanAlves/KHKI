import { Component, OnInit, inject } from '@angular/core';
import { ExplorationState } from '../workspace/exploration-state.service';
@Component({ selector: 'app-search-state', template: '' })
export class SearchStateComponent implements OnInit {
  private readonly state = inject(ExplorationState);
  ngOnInit(): void {
    this.state.enter('search');
    this.state.panelReady.update((value) => value + 1);
  }
}
