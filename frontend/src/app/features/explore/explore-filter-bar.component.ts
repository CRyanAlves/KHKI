import { Component, inject, input, output } from '@angular/core';
import { ExplorationState } from '../workspace/exploration-state.service';
import { IconComponent } from '../../shared/icon.component';
import { ExploreFilterPanelComponent } from './explore-filter-panel.component';

@Component({ selector: 'app-explore-filter-bar', imports: [IconComponent, ExploreFilterPanelComponent], template: `
  <div [class.filter-row]="!mobile()" [class.mobile-filter-row]="mobile()" role="group" aria-label="Filtros da busca">
    <button class="chip" type="button" [class.selected]="!!state.filterDraft() || state.filterCount() > 0" [attr.aria-expanded]="!!state.filterDraft()" aria-controls="explore-filters-panel" (click)="state.filterDraft() ? state.closeFilters() : state.openFilters()"><app-icon name="SlidersHorizontal" [size]="16" />Filtros@if (state.filterCount()) { · {{ state.filterCount() }} }</button>
    <button class="chip" type="button" [class.selected]="state.appliedFilters().accessible" [attr.aria-pressed]="state.appliedFilters().accessible" (click)="state.toggleShortcut('accessible')"><app-icon name="Accessibility" [size]="17" />Acessível</button>
    <button class="chip" type="button" [class.selected]="state.appliedFilters().items.includes('CHANGING_TABLE')" [attr.aria-pressed]="state.appliedFilters().items.includes('CHANGING_TABLE')" (click)="state.toggleShortcut('changingTable')"><app-icon name="Baby" [size]="17" />Fraldário</button>
    @if (areaSearchAvailable()) { <button class="chip mobile-search-area" type="button" [disabled]="state.loading()" (click)="areaSearchRequested.emit()"><app-icon name="Search" [size]="17" />Buscar nesta área</button> }
  </div>
  @if (state.filterCount()) {
    <div class="applied-filter-tags" aria-label="Filtros aplicados">@for (filter of state.activeFilters(); track filter.key) { <button class="applied-filter-tag" type="button" [attr.aria-label]="'Remover filtro: ' + filter.label" (click)="state.removeFilter(filter.key)">{{ filter.label }}<app-icon name="X" [size]="14" /></button> }<button class="text-button" type="button" (click)="state.clearFilters()">Limpar filtros</button></div>
  }
  @if (!mobile() && state.filterDraft()) { <app-explore-filter-panel /> }
`, styleUrl: './explore-filter-bar.component.scss' })
export class ExploreFilterBarComponent {
  readonly state = inject(ExplorationState);
  readonly mobile = input(false);
  readonly areaSearchAvailable = input(false);
  readonly areaSearchRequested = output<void>();
}
