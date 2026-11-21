import { apiError } from '../../../core/http/api-error';
import { ChangeDetectorRef, Directive, ElementRef, Input, inject, output } from '@angular/core';
import { NgForm } from '@angular/forms';

export interface AuthenticationFields {
  name: string;
  email: string;
  password: string;
  rememberMe: boolean;
}

@Directive()
export abstract class AuthenticationForm {
  @Input({ required: true }) fields!: AuthenticationFields;
  readonly busyChange = output<boolean>();
  readonly modeChange = output<void>();
  readonly dismiss = output<void>();
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  abstract readonly register: boolean;
  visible = false;
  error = '';
  busy = false;
  attempted = false;

  advanceToPassword(event: Event): void {
    event.preventDefault();
    this.element.nativeElement.querySelector<HTMLInputElement>('#login-password')?.focus();
  }

  protected abstract authenticate(): Promise<void>;

  async submit(form: NgForm): Promise<void> {
    if (this.busy) return;
    this.attempted = true;
    if (form.invalid) {
      form.control.markAllAsTouched();
      this.element.nativeElement.querySelector<HTMLInputElement>('input.ng-invalid')?.focus();
      return;
    }
    this.busy = true;
    this.busyChange.emit(true);
    this.error = '';
    try {
      await this.authenticate();
    } catch (error) {
      this.error = apiError(error);
    } finally {
      this.busy = false;
      this.busyChange.emit(false);
      this.changeDetector.markForCheck();
    }
  }
}
