import { Component, inject } from '@angular/core';
import { ConfirmationService } from '../core/confirmation.service';
import { DialogFocusDirective } from './dialog-focus.directive';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-confirmation',
  imports: [DialogFocusDirective, IconComponent],
  template: `@if (confirmation.request(); as request) {
    <div class="modal-backdrop" (click)="confirmation.finish(false)">
      <section class="confirmation-panel" role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title" aria-describedby="confirmation-message" appDialogFocus dialogInitialFocus="#confirmation-keep" (dialogEscape)="confirmation.finish(false)" (click)="$event.stopPropagation()">
        <header>
          <h2 id="confirmation-title">{{ request.title }}</h2>
          <button class="icon-button" type="button" aria-label="Fechar confirmação" (click)="confirmation.finish(false)"><app-icon name="X" /></button>
        </header>
        <p id="confirmation-message">{{ request.message }}</p>
        <div class="confirmation-actions">
          <button id="confirmation-keep" class="button secondary" type="button" (click)="confirmation.finish(false)">{{ request.cancelLabel }}</button><button class="button primary" type="button" (click)="confirmation.finish(true)">{{ request.confirmLabel }}</button>
        </div>
      </section>
    </div>
  }`,
  styleUrl: './confirmation.component.scss'
})
export class ConfirmationComponent {
  readonly confirmation = inject(ConfirmationService);
}
