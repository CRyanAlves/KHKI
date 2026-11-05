import { Injectable, signal } from '@angular/core';

export interface ConfirmationRequest {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
}

@Injectable({ providedIn: 'root' })
export class ConfirmationService {
  private readonly current = signal<ConfirmationRequest | null>(null);
  readonly request = this.current.asReadonly();
  private pending?: Promise<boolean>;
  private resolve?: (confirmed: boolean) => void;
  confirm(request: ConfirmationRequest): Promise<boolean> {
    if (this.pending) return this.pending;
    this.pending = new Promise<boolean>((resolve) => {
      this.resolve = resolve;
    });
    this.current.set(request);
    return this.pending;
  }
  finish(confirmed: boolean): void {
    const resolve = this.resolve;
    this.resolve = undefined;
    this.pending = undefined;
    this.current.set(null);
    resolve?.(confirmed);
  }
}
