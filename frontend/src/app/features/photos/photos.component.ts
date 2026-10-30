import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ExplorationState } from '../workspace/exploration-state.service';
import { ApiService } from '../../core/api.service';
import { validatePhoto } from '../../shared/photo-validation';
import { IconComponent } from '../../shared/icon.component';

import { SkeletonComponent } from '../../shared/skeleton.component';

@Component({
  selector: 'app-photos',
  imports: [SkeletonComponent, RouterLink, IconComponent],
  template: `<main class="narrow-page">
    <a class="back-link" [routerLink]="['/banheiros', id]"><app-icon name="ArrowLeft" [size]="18" />Voltar ao banheiro</a>
    <section class="surface form-surface">
      <span class="eyebrow">AJUDE QUEM VEM DEPOIS</span>
      <h1>Enviar uma foto<span class="accent">.</span></h1>
      <p class="muted">{{ name }}</p>
      @if (loading) {
        <app-skeleton variant="form" label="Carregando formulário…" />
      } @else if (sent) {
        <div class="submission-success">
          <app-icon name="CheckCircle" [size]="40" />
          <h2>Foto em análise</h2>
          <p>A imagem está privada e será analisada por uma pessoa antes de ser publicada.</p>
          <a routerLink="/contribuicoes" class="button primary">Acompanhar contribuição</a>
        </div>
      } @else {
        <form (submit)="$event.preventDefault(); submit()">
          <div class="photo-warning">
            <app-icon name="Camera" [size]="28" />
            <p>Envie apenas fotos do banheiro vazio, sem pessoas, reflexos de pessoas ou informações pessoais.</p>
          </div>
          <label>Foto do banheiro *<input type="file" accept="image/jpeg,image/png" required (change)="choose($event)" /></label>
          <p class="muted">JPG ou PNG, até 5 MB. A aprovação desta foto é independente das avaliações.</p>
          @if (error) {
            <p role="alert" class="error-message">{{ error }}</p>
          }
          <button class="button primary full" [disabled]="busy || !file">{{ busy ? 'Enviando…' : 'Enviar foto para análise' }}</button>
        </form>
      }
    </section>
  </main>`
})
export class PhotosComponent implements OnInit {
  private readonly exploration = inject(ExplorationState);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly changeDetector = inject(ChangeDetectorRef);
  loading = true;
  id = '';
  name = '';
  file: File | null = null;
  error = '';
  sent = false;
  busy = false;
  async ngOnInit(): Promise<void> {
    this.exploration.enter('photos');
    this.id = this.route.snapshot.paramMap.get('id')!;
    try {
      this.name = (await this.exploration.select(this.id))?.name || '';
    } catch (error) {
      this.error = this.api.error(error);
    } finally {
      this.loading = false;
      this.changeDetector.markForCheck();
      this.exploration.panelReady.update((value) => value + 1);
    }
  }
  choose(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    this.error = file ? validatePhoto(file) || '' : '';
    this.file = this.error ? null : file || null;
  }
  async submit(): Promise<void> {
    if (!this.file) return;
    this.busy = true;
    this.error = '';
    try {
      const data = new FormData();
      data.append('file', this.file);
      await this.api.post('/bathrooms/' + this.id + '/photos', data);
      this.sent = true;
    } catch (error) {
      this.error = this.api.error(error);
    } finally {
      this.busy = false;
      this.changeDetector.markForCheck();
    }
  }
}
