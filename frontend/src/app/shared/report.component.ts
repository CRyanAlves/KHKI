import { ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { TargetType } from '../core/models';
import { IconComponent } from './icon.component';
import { DialogFocusDirective } from './dialog-focus.directive';

@Component({
  selector: 'app-report',
  imports: [FormsModule, IconComponent, DialogFocusDirective],
  template: `@if (auth.user()) {
    <div class="modal-backdrop">
      <form class="small-modal" role="dialog" aria-modal="true" aria-labelledby="report-title" appDialogFocus (dialogEscape)="!busy && closed.emit()" (ngSubmit)="submit()">
        <button type="button" class="icon-button modal-close" aria-label="Fechar" (click)="closed.emit()"><app-icon name="X" /></button><span class="eyebrow">AJUDE A CUIDAR DA COMUNIDADE</span>
        <h2 id="report-title">Denunciar conteúdo</h2>
        <p class="muted">Sua denúncia será analisada por uma pessoa da moderação.</p>
        <label
          >Motivo<select name="reason" [(ngModel)]="reason" required>
            <option value="INCORRECT">Informação incorreta</option>
            <option value="CLOSED">Local fechado ou indisponível</option>
            <option value="PRIVACY">Pessoas ou informações pessoais</option>
            <option value="INAPPROPRIATE">Conteúdo inadequado</option>
            <option value="SPAM">Spam</option>
            <option value="OTHER">Outro motivo</option>
          </select></label
        >
        @if (message) {
          <p role="status">{{ message }}</p>
        }
        <button class="button primary full" [disabled]="busy || sent">{{ sent ? 'Denúncia recebida' : busy ? 'Enviando…' : 'Enviar denúncia' }}</button>
      </form>
    </div>
  }`
})
export class ReportComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private awaitingLogin = false;
  private readonly changeDetector = inject(ChangeDetectorRef);
  @Input({ required: true }) target!: { type: TargetType; id: string };
  @Output() closed = new EventEmitter<void>();
  private readonly api = inject(ApiService);
  reason = 'INCORRECT';
  message = '';
  busy = false;
  sent = false;
  constructor() {
    effect(() => {
      const loginOpened = this.auth.opened();
      const user = this.auth.user();
      if (!this.awaitingLogin || loginOpened) return;
      this.awaitingLogin = false;
      if (!user) this.closed.emit();
    });
  }
  ngOnInit(): void {
    this.awaitingLogin = !this.auth.require(this.router.url);
  }
  async submit(): Promise<void> {
    if (this.busy || this.sent) return;
    if (!this.auth.require(this.router.url)) {
      this.awaitingLogin = true;
      return;
    }
    this.busy = true;
    try {
      await this.api.get('/auth/csrf');
      await this.api.post('/reports', { targetType: this.target.type, targetId: this.target.id, reason: this.reason });
      this.sent = true;
      this.message = 'Obrigado. A denúncia foi recebida para análise.';
    } catch (error) {
      this.message = this.api.error(error);
    } finally {
      this.changeDetector.markForCheck();
      this.busy = false;
    }
  }
}
