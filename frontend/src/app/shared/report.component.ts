import { ChangeDetectorRef, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { TargetType } from '../core/models';
import { IconComponent } from './icon.component';
import { DialogFocusDirective } from './dialog-focus.directive';

@Component({
  selector: 'app-report',
  imports: [FormsModule, IconComponent, DialogFocusDirective],
  template: `<div class="modal-backdrop">
    <form class="small-modal" role="dialog" aria-modal="true" aria-labelledby="report-title" appDialogFocus (dialogEscape)="!busy && closed.emit()" (ngSubmit)="submit()">
      <button type="button" class="icon-button modal-close" aria-label="Fechar" (click)="closed.emit()"><app-icon name="X" /></button><span class="eyebrow">AJUDE A CUIDAR DA COMUNIDADE</span>
      <h2 id="report-title">Denunciar conteúdo</h2>
      <p class="muted">Sua denúncia será analisada por uma pessoa da moderação. Não é necessário ter uma conta.</p>
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
  </div>`
})
export class ReportComponent {
  private readonly changeDetector = inject(ChangeDetectorRef);
  @Input({ required: true }) target!: { type: TargetType; id: string };
  @Output() closed = new EventEmitter<void>();
  private readonly api = inject(ApiService);
  reason = 'INCORRECT';
  message = '';
  busy = false;
  sent = false;
  async submit(): Promise<void> {
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
