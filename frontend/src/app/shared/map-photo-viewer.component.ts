import { Component, ElementRef, HostListener, OnDestroy, afterNextRender, inject, signal } from '@angular/core';
import { ExplorationState } from '../features/workspace/exploration-state.service';
import { IconComponent } from './icon.component';
import { ReportComponent } from './report.component';
@Component({ selector: 'app-map-photo-viewer', imports: [IconComponent, ReportComponent], templateUrl: './map-photo-viewer.component.html', styleUrl: './map-photo-viewer.component.scss' })
export class MapPhotoViewerComponent implements OnDestroy {
  readonly state = inject(ExplorationState);
  readonly failed = signal('');
  readonly imageRatio = signal(1);
  readonly availableHeight = signal(0);
  private observer?: ResizeObserver;
  report = '';
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly previous = document.activeElement as HTMLElement | null;
  constructor() {
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
    if (this.report || event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.state.closePhoto();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      this.state.movePhoto(event.key === 'ArrowLeft' ? -1 : 1);
    }
  }
  ngOnDestroy(): void {
    this.observer?.disconnect();
    requestAnimationFrame(() => {
      if (this.previous?.isConnected) this.previous.focus({ preventScroll: true });
    });
  }
}
