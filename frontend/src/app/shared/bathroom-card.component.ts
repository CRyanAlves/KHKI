import { Component, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { Bathroom, ACCESS_LABELS } from '../core/models';
import { IconComponent } from './icon.component';

@Component({ selector: 'app-bathroom-card', imports: [RouterLink, DecimalPipe, IconComponent], templateUrl: './bathroom-card.component.html' })
export class BathroomCardComponent {
  readonly bathroom = input.required<Bathroom>();
  readonly distance = input<number | null>(null);
  readonly selected = input(false);
  readonly failedPhoto = signal('');
  readonly stars = [1, 2, 3, 4, 5];
  readonly accessLabels = ACCESS_LABELS;
  get ratingPercent(): number {
    return Math.min(5, Math.max(0, this.bathroom().rating || 0)) * 20;
  }
}
