import { Directive, ElementRef, EventEmitter, HostListener, Input, OnDestroy, Output, afterNextRender, inject } from '@angular/core';

@Directive({ selector: '[appDialogFocus]' })
export class DialogFocusDirective implements OnDestroy {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly previous = document.activeElement as HTMLElement | null;
  @Input() dialogInitialFocus = '';
  @Input() dialogReturnFocus: HTMLElement | null = null;
  @Output() dialogEscape = new EventEmitter<void>();
  constructor() {
    afterNextRender(() => (this.element.nativeElement.querySelector<HTMLElement>(this.dialogInitialFocus || 'input, select, textarea') || this.controls()[0])?.focus({ preventScroll: !!this.dialogInitialFocus }));
  }
  private controls(): HTMLElement[] {
    return Array.from(this.element.nativeElement.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]')).filter((control) => control.offsetParent !== null);
  }
  @HostListener('document:keydown', ['$event']) keyboard(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      this.dialogEscape.emit();
    }
    if (event.key !== 'Tab') return;
    const controls = this.controls(),
      first = controls[0],
      last = controls[controls.length - 1];
    if (!first) return;
    if (!controls.includes(document.activeElement as HTMLElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  ngOnDestroy(): void {
    const previous = this.dialogReturnFocus || this.previous;
    if (previous?.isConnected) previous.focus({ preventScroll: !!this.dialogReturnFocus });
  }
}
