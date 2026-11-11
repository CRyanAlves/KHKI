import { Component, ElementRef, HostListener, OnDestroy, afterNextRender, inject, signal } from '@angular/core';
import { ExplorationState } from '../features/workspace/exploration-state.service';
import { IconComponent } from './icon.component';
import { MobileUiService } from '../core/mobile-ui.service';
import { motionDurationMilliseconds } from './motion-duration';
@Component({ selector: 'app-map-photo-viewer', imports: [IconComponent], templateUrl: './map-photo-viewer.component.html', styleUrl: './map-photo-viewer.component.scss' })
export class MapPhotoViewerComponent implements OnDestroy {
  readonly state = inject(ExplorationState);
  readonly mobileUi = inject(MobileUiService);
  private touch: { x: number; y: number } | null = null;
  choosePhoto(index: number): void {
    const view = this.state.photoView();
    if (view && Number.isSafeInteger(index) && index >= 0 && index < view.photoIds.length) this.state.photoView.set({ ...view, index });
  }
  swipeStart(event: TouchEvent): void {
    if (this.mobileUi.mobile() && event.touches.length === 1) this.touch = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }
  swipeEnd(event: TouchEvent): void {
    if (!this.touch || !event.changedTouches.length) return;
    const delta = event.changedTouches[0].clientX - this.touch.x;
    if (Math.abs(delta) > 45 && Math.abs(delta) > Math.abs(event.changedTouches[0].clientY - this.touch.y)) this.state.movePhoto(delta < 0 ? 1 : -1);
    this.touch = null;
  }
  readonly failed = signal('');
  readonly imageRatio = signal(1);
  readonly availableHeight = signal(0);
  private observer?: ResizeObserver;
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly previous = this.state.photoOpener || (document.activeElement as HTMLElement | null);
  private readonly historyToken = crypto.randomUUID();
  close(): void {
    if (this.mobileUi.mobile() && history.state?.khkiPhotoViewer === this.historyToken) history.back();
    else this.state.closePhoto();
  }
  @HostListener('window:popstate') deviceBack(): void {
    if (this.mobileUi.mobile()) this.state.closePhoto();
  }
  constructor() {
    if (this.mobileUi.mobile()) history.pushState({ ...history.state, khkiPhotoViewer: this.historyToken }, '', location.href);
    afterNextRender(() => {
      const element = this.element.nativeElement;
      this.availableHeight.set(element.clientHeight);
      this.observer = new ResizeObserver(() => this.availableHeight.set(element.clientHeight));
      this.observer.observe(element);
      element.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
    });
  }
  imageLoaded(event: Event): void {
    const image = event.target as HTMLImageElement;
    if (image.naturalWidth > 0 && image.naturalHeight > 0) this.imageRatio.set(image.naturalWidth / image.naturalHeight);
  }
  @HostListener('keydown', ['$event']) keyboard(event: KeyboardEvent): void {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      this.state.movePhoto(event.key === 'ArrowLeft' ? -1 : 1);
    }
  }
  ngOnDestroy(): void {
    this.observer?.disconnect();
    const deadline = performance.now() + motionDurationMilliseconds(getComputedStyle(document.documentElement).getPropertyValue('--motion-panel-duration'));
    const restoreFocus = () => {
      if (!this.previous?.isConnected) return;
      if (this.previous.closest('[inert]') || getComputedStyle(this.previous).visibility === 'hidden') {
        if (performance.now() < deadline) requestAnimationFrame(restoreFocus);
        return;
      }
      this.previous.focus({ preventScroll: true });
    };
    requestAnimationFrame(restoreFocus);
  }
}
