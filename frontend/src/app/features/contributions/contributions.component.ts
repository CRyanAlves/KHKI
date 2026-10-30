import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../core/api.service';
import { Contribution, STATUS_LABELS } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';

import { SkeletonComponent } from '../../shared/skeleton.component';

@Component({
  selector: 'app-contributions',
  imports: [SkeletonComponent, RouterLink, DatePipe, IconComponent],
  template: `<main class="page-container">
    <div class="page-title">
      <div>
        <span class="eyebrow">CADA CONTRIBUIÇÃO IMPORTA</span>
        <h1>Minhas contribuições<span class="accent">.</span></h1>
        <p class="muted">Acompanhe seus cadastros, avaliações e fotos.</p>
      </div>
      <a class="button primary" routerLink="/cadastrar"><app-icon name="Plus" [size]="18" />Cadastrar banheiro</a>
    </div>
    <div class="notice">
      <app-icon name="ShieldCheck" />
      <p>Conteúdo em análise ainda não é público. As fotos são avaliadas separadamente do cadastro.</p>
    </div>
    @if (error) {
      <p role="alert" class="error-message">{{ error }}</p>
    }
    @if (loading) {
      <app-skeleton variant="rows" label="Carregando contribuições…" />
    }
    @for (item of items; track item.id) {
      <article class="surface contribution-row">
        <span class="contribution-icon"><app-icon [name]="item.type === 'PHOTO' ? 'Camera' : item.type === 'REVIEW' ? 'Star' : 'MapPin'" /></span>
        <div>
          <small class="eyebrow">{{ item.type === 'PHOTO' ? 'FOTO' : item.type === 'REVIEW' ? 'AVALIAÇÃO' : 'CADASTRO' }}</small>
          <h3>{{ item.title }}</h3>
          <small class="muted">Enviado em {{ item.createdAt | date: 'dd/MM/yyyy' }}</small>
          @if (item.reason) {
            <p class="decision-reason">Motivo da decisão: {{ item.reason }}</p>
          }
          @if ((item.status === 'REJECTED' || item.status === 'NEEDS_INFORMATION') && item.type !== 'PHOTO') {
            <a class="text-button" [routerLink]="item.type === 'BATHROOM' ? ['/cadastrar'] : ['/banheiros', item.bathroomId, 'avaliar']" [queryParams]="{ edit: item.id }">Corrigir e reenviar<app-icon name="ArrowRight" [size]="16" /></a>
          }
        </div>
        <span class="tag" [class.success]="item.status === 'APPROVED'" [class.warning]="item.status === 'PENDING' || item.status === 'NEEDS_INFORMATION'">{{ labels[item.status] }}</span>
      </article>
    } @empty {
      @if (!loading && !error) {
        <div class="state-box">
          <app-icon name="Heart" [size]="34" />
          <h2>Sua primeira contribuição começa aqui.</h2>
          <p>Cadastre um banheiro ou conte sua experiência em um local.</p>
        </div>
      }
    }
  </main>`
})
export class ContributionsComponent implements OnInit {
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly api = inject(ApiService);
  readonly labels = STATUS_LABELS;
  items: Contribution[] = [];
  loading = true;
  error = '';
  async ngOnInit(): Promise<void> {
    try {
      this.items = await this.api.get<Contribution[]>('/me/contributions');
    } catch (error) {
      this.error = this.api.error(error);
    } finally {
      this.changeDetector.markForCheck();
      this.loading = false;
    }
  }
}
