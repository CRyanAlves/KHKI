import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { Bathroom, ACCESS_LABELS } from '../core/models';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-bathroom-card',
  imports: [RouterLink, DecimalPipe, IconComponent],
  template: `<a class="bathroom-card" [routerLink]="['/banheiros', bathroom().id]"
    ><div class="card-photo">
      @if (bathroom().photoIds.length) {
        <img [src]="'/api/photos/' + bathroom().photoIds[0]" alt="Foto aprovada do banheiro" />
      } @else {
        <app-icon name="Toilet" [size]="36" /><span>Sem foto publicada</span>
      }
    </div>
    <div class="card-body">
      <div class="card-heading">
        <h3>{{ bathroom().name }}</h3>
        <app-icon name="ChevronRight" [size]="18" />
      </div>
      <p class="rating">
        <app-icon name="Star" [size]="17" />
        @if (bathroom().rating !== null) {
          <strong>{{ bathroom().rating | number: '1.1-1' }}</strong
          ><span>({{ bathroom().reviewCount }} {{ bathroom().reviewCount === 1 ? 'avaliação' : 'avaliações' }})</span>
        } @else {
          <span>Ainda sem avaliações</span>
        }
      </p>
      <p class="muted">
        {{ bathroom().category }}
        @if (distance() !== null) {
          <span class="card-distance"> · {{ distance()! >= 1000 ? (distance()! / 1000 | number: '1.1-1') + ' km' : distance() + ' m' }} em linha reta</span>
        }
      </p>
      @if (bathroom().hours) {
        <p class="card-hours"><app-icon name="Clock" [size]="13" />{{ bathroom().hours }}</p>
      }
      <p class="card-address">{{ bathroom().address }}</p>
      <div class="card-tags">
        <span class="tag">{{ accessLabels[bathroom().access] }}</span>
        @if (bathroom().accessible) {
          <app-icon name="Accessibility" [size]="18" />
        }
        @if (bathroom().items.includes('CHANGING_TABLE')) {
          <app-icon name="Baby" [size]="18" />
        }
      </div>
      @if (bathroom().demo) {
        <small class="demo-label">Exemplo de demonstração</small>
      }
    </div></a
  >`
})
export class BathroomCardComponent {
  readonly bathroom = input.required<Bathroom>();
  readonly distance = input<number | null>(null);
  readonly accessLabels = ACCESS_LABELS;
}
