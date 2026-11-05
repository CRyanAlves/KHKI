import { DestroyRef, Directive, ElementRef, HostListener, inject } from '@angular/core';
import { MobileUiService } from '../core/mobile-ui.service';

@Directive({ selector: '[appMobileSheet]' })
export class MobileSheetDirective {
  private readonly ui = inject(MobileUiService);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private gesture: { x: number; y: number; lastY: number; initial: number; fraction: number; maximum: number; height: number; handle: boolean; scroll: HTMLElement | null; dragging: boolean } | null = null;
  constructor() {
    const node = this.element.nativeElement;
    const start = (event: TouchEvent) => {
      if (event.touches.length === 1) this.begin(event.touches[0].clientX, event.touches[0].clientY, event.target);
    };
    const move = (event: TouchEvent) => {
      if (event.touches.length === 1) this.move(event.touches[0].clientX, event.touches[0].clientY, event);
    };
    const end = () => this.end();
    const click = (event: MouseEvent) => {
      if (this.ui.mobile() && Date.now() < this.ui.suppressClickUntil) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    node.addEventListener('touchstart', start, { passive: true });
    node.addEventListener('touchmove', move, { passive: false });
    node.addEventListener('touchend', end);
    node.addEventListener('touchcancel', end);
    node.addEventListener('click', click, true);
    inject(DestroyRef).onDestroy(() => {
      node.removeEventListener('touchstart', start);
      node.removeEventListener('touchmove', move);
      node.removeEventListener('touchend', end);
      node.removeEventListener('touchcancel', end);
      node.removeEventListener('click', click, true);
    });
  }
  private begin(x: number, y: number, target: EventTarget | null): void {
    if (!this.ui.mobile() || !(target instanceof Element)) return;
    const handle = !!target.closest('.mobile-sheet-handle');
    if (!handle && target.closest('.detail-actions, .details-close')) return;
    if (!handle && target.closest('input, select, textarea, [role="listbox"]')) return;
    let scroll = target.closest<HTMLElement>('.registration-fields, .result-list, .workspace-content') || (target.closest('.workspace-results') ? this.element.nativeElement.querySelector<HTMLElement>('.result-list') : null);
    if (scroll?.matches('.workspace-content')) scroll = scroll.querySelector<HTMLElement>('.registration-fields') || scroll;
    const workspace = this.element.nativeElement.closest('.map-workspace') as HTMLElement;
    if (!handle && !scroll) return;
    const navbar = this.ui.navbar() ? document.querySelector('.mobile-bottom-nav')?.getBoundingClientRect().height || 0 : 0;
    const height = workspace.clientHeight - navbar;
    const maximum = Math.max(this.ui.stops[0], Math.min(this.ui.stops[2], (workspace.clientHeight * this.ui.stops[2] - navbar) / height));
    const fraction = this.element.nativeElement.getBoundingClientRect().height / height;
    this.gesture = { x, y, lastY: y, initial: fraction, fraction, maximum, height, handle, scroll, dragging: false };
  }
  private move(x: number, y: number, event: Event): void {
    const gesture = this.gesture;
    if (!gesture) return;
    const travel = gesture.y - y;
    if (!gesture.dragging && Math.abs(travel) < 8) return;
    if (!gesture.dragging && Math.abs(x - gesture.x) > Math.abs(travel)) {
      this.gesture = null;
      return;
    }
    gesture.dragging = true;
    if (event.cancelable) event.preventDefault();
    let delta = gesture.lastY - y;
    gesture.lastY = y;
    if (!gesture.handle && gesture.scroll && delta < 0 && gesture.scroll.scrollTop > 0) {
      const consumed = Math.min(gesture.scroll.scrollTop, -delta);
      gesture.scroll.scrollTop -= consumed;
      delta += consumed;
    }
    if (delta !== 0) {
      const previous = gesture.fraction;
      gesture.fraction = Math.max(this.ui.stops[0], Math.min(gesture.maximum, previous + delta / gesture.height));
      delta -= (gesture.fraction - previous) * gesture.height;
    }
    this.ui.drag.set(gesture.fraction);
    if (gesture.fraction >= gesture.maximum - 0.001) {
      this.ui.sheet.set(2);
      if (!gesture.handle && gesture.scroll && delta > 0) gesture.scroll.scrollTop += delta;
    }
  }
  private end(): void {
    const gesture = this.gesture;
    if (gesture?.dragging) {
      if (gesture.fraction >= gesture.maximum - 0.001) {
        this.ui.sheet.set(2);
        this.ui.drag.set(null);
        this.ui.suppressClickUntil = Date.now() + 300;
      } else this.ui.settle(gesture.fraction, gesture.fraction - gesture.initial, gesture.maximum);
      if (this.ui.sheet() < 2 && gesture.scroll) gesture.scroll.scrollTop = 0;
    }
    this.gesture = null;
  }
  @HostListener('pointerdown', ['$event']) pointerDown(event: PointerEvent): void {
    if (event.pointerType !== 'touch' && event.button === 0) this.begin(event.clientX, event.clientY, event.target);
  }
  @HostListener('window:pointermove', ['$event']) pointerMove(event: PointerEvent): void {
    if (event.pointerType !== 'touch') this.move(event.clientX, event.clientY, event);
  }
  @HostListener('window:pointerup') pointerUp(): void {
    this.end();
  }
  @HostListener('focusin', ['$event']) focus(event: FocusEvent): void {
    const target = event.target;
    if (!this.ui.mobile() || !(target instanceof HTMLElement) || !target.matches('input, select, textarea') || !target.closest('.workspace-content')) return;
    this.ui.sheet.set(2);
    requestAnimationFrame(() => {
      const scroll = target.closest<HTMLElement>('.registration-fields, .workspace-content');
      if (!scroll) return;
      const offset = target.getBoundingClientRect().bottom - scroll.getBoundingClientRect().bottom;
      if (offset > 0) scroll.scrollTop += offset;
    });
  }
}
