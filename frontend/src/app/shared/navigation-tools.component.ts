import { Component, Input, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { NavigationService } from '../core/navigation.service';
import type { TravelRoute } from '../core/maps.service';
import { IconComponent } from './icon.component';

@Component({ selector: 'app-navigation-tools', imports: [IconComponent, DecimalPipe], templateUrl: './navigation-tools.component.html' })
export class NavigationToolsComponent {
  readonly navigation = inject(NavigationService);
  @Input() route: TravelRoute | null = null;
  speed(event: Event): void {
    this.navigation.setSimulationSpeed(Number((event.target as HTMLSelectElement).value));
  }
}
