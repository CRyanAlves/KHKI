import { ChangeDetectorRef, Component, DestroyRef, OnDestroy, OnInit, ViewEncapsulation, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ExplorationState } from '../workspace/exploration-state.service';
import { DecimalPipe } from '@angular/common';
import { LucideCar, LucideDynamicIcon } from '@lucide/angular';
import { ApiService } from '../../core/api.service';
import { Bathroom, Location } from '../../core/models';
import { MapsService, TravelMode, TravelRoute } from '../../core/maps.service';
import { NavigationService } from '../../core/navigation.service';
import { IconComponent } from '../../shared/icon.component';

import { SkeletonComponent } from '../../shared/skeleton.component';

@Component({
  selector: 'app-route',
  imports: [SkeletonComponent, RouterLink, FormsModule, DecimalPipe, IconComponent, LucideDynamicIcon],
  styleUrl: '../../../styles/workspace-route.scss',
  encapsulation: ViewEncapsulation.None,
  template: `<section class="route-panel">
    <a [routerLink]="['/banheiros', bathroom?.id]" class="back-link"><app-icon name="ArrowLeft" [size]="18" />Voltar aos detalhes</a><span class="eyebrow">UM CAMINHO MAIS TRANQUILO</span>
    <h1>Como chegar<span class="accent">.</span></h1>
    @if (loading) {
      <app-skeleton variant="form" label="Carregando destino…" />
    } @else if (bathroom) {
      <form (ngSubmit)="calculate()">
        <label>Sua origem<input name="origin" [(ngModel)]="origin" (ngModelChange)="originChanged()" [disabled]="busy" maxlength="300" placeholder="Informe um endereço completo" [required]="!position" /></label><button type="button" class="text-button location-choice" [disabled]="busy" (click)="locate()"><app-icon name="LocateFixed" [size]="17" />Usar minha localização</button
        ><small class="muted">Sua permissão será solicitada apenas ao escolher essa opção.</small>
        <div class="destination-box">
          <app-icon name="MapPin" [size]="25" />
          <div>
            <strong>{{ bathroom.name }}</strong>
            <p>{{ bathroom.address }}</p>
          </div>
        </div>
        <fieldset class="travel-mode" [disabled]="busy">
          <legend>Como você vai?</legend>
          <div class="travel-mode-options">
            <label [class.selected]="mode === 'drive'"><input type="radio" name="mode" value="drive" [ngModel]="mode" (ngModelChange)="setMode($event)" /><svg [lucideIcon]="carIcon" [size]="20" [strokeWidth]="1.8" aria-hidden="true" />Carro</label
            ><label [class.selected]="mode === 'walk'"><input type="radio" name="mode" value="walk" [ngModel]="mode" (ngModelChange)="setMode($event)" /><app-icon name="Footprints" />A pé</label>
          </div>
          <small class="muted">{{ mode === 'drive' ? 'Considera o sentido das vias e as restrições para carros registradas no mapa.' : 'Percurso de pedestre; não deve ser usado para dirigir.' }}</small>
        </fieldset>
        <button class="button primary full" [disabled]="busy">{{ busy ? 'Calculando rota…' : 'Calcular rota' }}<app-icon name="Navigation" [size]="19" /></button>
      </form>
      @if (bathroom.demo) {
        <p class="demo-banner">Destino fictício de demonstração.</p>
      }
      @if (busy) {
        <app-skeleton variant="route" label="Calculando rota…" />
      } @else if (route) {
        <div class="route-summary">
          <span class="eyebrow">TRAJETO ESTIMADO PELA GEOAPIFY</span>
          <h2>{{ route.durationMillis !== undefined ? minutes + ' min' : 'Tempo não informado' }}</h2>
          <p>{{ route.distanceMeters !== undefined ? (route.distanceMeters / 1000 | number: '1.1-2') + (mode === 'drive' ? ' km de carro' : ' km a pé') : 'Distância não informada' }}</p>
          <small>{{ mode === 'drive' ? 'Respeite a sinalização local; os dados do mapa podem estar desatualizados.' : 'A rota pode não refletir calçadas ou condições de acessibilidade. Confira o trajeto antes de sair.' }}</small>
        </div>
        <div class="navigation-route-controls">
          @if (!navigation.active()) {
            <button class="button primary full" type="button" (click)="navigation.start()"><app-icon name="Navigation" />Iniciar navegação</button>
          } @else {
            <button class="button secondary full" type="button" (click)="navigation.stop()">Encerrar navegação</button>
            @if (!navigation.simulated()) {
              <button class="text-button" type="button" (click)="navigation.requestOrientation()">Ativar bússola do aparelho</button>
            }
            <small>{{ navigation.sensorStatus() }}</small>
          }
          @if (navigation.notice()) {
            <p role="status">{{ navigation.notice() }}</p>
          }
        </div>
        @for (instruction of instructions; track $index) {
          <p class="route-step"><app-icon name="ArrowRight" [size]="17" />{{ instruction }}</p>
        }
        <p class="muted route-attribution">Dados de rota: Geoapify e OpenStreetMap. {{ mode === 'drive' ? 'Tenha atenção ao dirigir.' : 'Tenha atenção ao caminhar.' }}</p>
      } @else {
        <div class="route-empty">
          @if (mode === 'drive') {
            <svg [lucideIcon]="carIcon" [size]="32" [strokeWidth]="1.8" aria-hidden="true" />
          } @else {
            <app-icon name="Footprints" [size]="32" />
          }
          <p>Escolha uma origem para ver o caminho, a distância e o tempo estimado.</p>
        </div>
      }
    }
    @if (error) {
      <p class="error-message" role="alert">{{ error }}</p>
    }
  </section>`
})
export class RouteComponent implements OnInit, OnDestroy {
  readonly state = inject(ExplorationState);
  readonly navigation = inject(NavigationService);
  private readonly destroyRef = inject(DestroyRef);
  private loadSequence = 0;
  private calculation = 0;
  readonly carIcon = LucideCar;
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly api = inject(ApiService);
  private readonly activatedRoute = inject(ActivatedRoute);
  readonly maps = inject(MapsService);
  bathroom: Bathroom | null = null;
  origin = '';
  position: Location | null = null;
  route: TravelRoute | null = null;
  mode: TravelMode = 'drive';
  busy = false;
  loading = true;
  error = '';
  instructions: string[] = [];
  constructor() {
    effect(() => {
      const update = this.navigation.rerouted();
      if (!update || !this.navigation.active() || !this.bathroom) return;
      this.route = update.route;
      this.instructions = update.route.instructions;
      this.position = update.origin;
      this.origin = '';
      this.state.path.set(update.route);
      this.state.routeOrigin.set(update.origin);
      this.saveDraft();
      this.changeDetector.markForCheck();
    });
  }
  get minutes(): number {
    return Math.max(1, Math.round((this.route?.durationMillis || 0) / 60000));
  }
  ngOnInit(): void {
    this.state.enter('route');
    this.activatedRoute.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((parameters) => {
      void this.load(parameters.get('id')!);
    });
  }
  private async load(id: string): Promise<void> {
    this.navigation.stop();
    this.saveDraft();
    this.calculation++;
    this.loading = true;
    this.busy = false;
    this.bathroom = null;
    this.origin = '';
    this.position = null;
    this.route = null;
    this.mode = 'drive';
    this.instructions = [];
    this.error = '';
    const sequence = ++this.loadSequence;
    const draft = this.state.routeDrafts.get(id);
    if (draft) {
      this.origin = draft.origin;
      this.position = draft.position;
      this.mode = draft.mode;
      this.route = draft.route;
      this.instructions = draft.route?.instructions || [];
    } else {
      this.state.path.set(null);
    }
    if (this.route) this.navigation.prepare(this.route, this.mode);
    this.state.path.set(this.route);
    this.state.routeOrigin.set(this.position);
    try {
      const bathroom = await this.state.select(id);
      if (sequence === this.loadSequence && !this.destroyRef.destroyed) this.bathroom = bathroom;
    } catch (error) {
      if (sequence === this.loadSequence) this.error = this.api.error(error);
    } finally {
      if (sequence === this.loadSequence) this.loading = false;
      this.changeDetector.markForCheck();
      this.state.panelReady.update((value) => value + 1);
    }
  }
  ngOnDestroy(): void {
    this.navigation.stop();
    this.loadSequence++;
    this.calculation++;
    this.saveDraft();
  }
  private saveDraft(): void {
    if (this.bathroom) this.state.routeDrafts.set(this.bathroom.id, { origin: this.origin, position: this.position, mode: this.mode, route: this.route });
  }
  setMode(mode: TravelMode): void {
    if (this.busy || !['walk', 'drive'].includes(mode) || this.mode === mode) return;
    this.mode = mode;
    this.resetRoute();
  }
  private resetRoute(): void {
    this.navigation.stop();
    this.calculation++;
    this.route = null;
    this.instructions = [];
    this.error = '';
    this.state.path.set(null);
  }
  originChanged(): void {
    this.position = null;
    this.state.routeOrigin.set(null);
    this.resetRoute();
  }
  async locate(): Promise<void> {
    this.resetRoute();
    try {
      this.position = await this.maps.location();
      this.state.routeOrigin.set(this.position);
      this.origin = '';
    } catch (error) {
      this.error = this.api.error(error);
    } finally {
      this.changeDetector.markForCheck();
    }
  }
  async calculate(): Promise<void> {
    if (!this.bathroom || this.busy) return;
    this.busy = true;
    this.resetRoute();
    const sequence = this.calculation;
    const destination = this.bathroom;
    try {
      if (!this.position && !this.origin.trim()) throw new Error('Informe uma origem ou autorize sua localização.');
      const route = await this.maps.directions(this.origin.trim() || this.position!, { lat: destination.latitude, lng: destination.longitude }, this.mode);
      if (sequence !== this.calculation || this.destroyRef.destroyed) return;
      this.route = route;
      this.navigation.prepare(route, this.mode);
      this.instructions = route.instructions;
      this.state.path.set(route);
    } catch (error) {
      if (sequence === this.calculation) this.error = this.api.error(error);
    } finally {
      if (sequence === this.calculation) {
        this.busy = false;
        this.changeDetector.markForCheck();
      }
    }
  }
}
