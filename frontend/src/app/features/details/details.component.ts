import { BathroomMetadataComponent } from '../../shared/bathroom-metadata.component';
import { ChangeDetectorRef, Component, DestroyRef, OnDestroy, OnInit, ViewEncapsulation, ElementRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ExplorationState } from '../workspace/exploration-state.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Bathroom, Review, ACCESS_LABELS, ITEM_LABELS, TargetType } from '../../core/models';
import { motionDurationMilliseconds } from '../../shared/motion-duration';
import { IconComponent } from '../../shared/icon.component';
import { ReportComponent } from '../../shared/report.component';
import { MobileUiService } from '../../core/mobile-ui.service';

import { SkeletonComponent } from '../../shared/skeleton.component';

@Component({ selector: 'app-details', imports: [BathroomMetadataComponent, SkeletonComponent, RouterLink, DatePipe, DecimalPipe, IconComponent, ReportComponent], templateUrl: './details.component.html', styleUrls: ['../../../styles/workspace-details.scss', '../../../styles/workspace-gallery.scss'], encapsulation: ViewEncapsulation.None })
export class DetailsComponent implements OnInit, OnDestroy {
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly api = inject(ApiService);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private routeAnimation?: Animation;
  routeOpening = false;
  routeError = '';
  readonly state = inject(ExplorationState);
  private readonly destroyRef = inject(DestroyRef);
  private request = 0;
  readonly auth = inject(AuthService);
  readonly mobileUi = inject(MobileUiService);
  bathroom: Bathroom | null = null;
  reviews: Review[] = [];
  error = '';
  tab: 'overview' | 'photos' | 'reviews' = 'overview';
  readonly failedPhotos = new Set<string>();
  report: { type: TargetType; id: string } | null = null;
  readonly accessLabels = ACCESS_LABELS;
  readonly itemLabels = ITEM_LABELS;
  ngOnInit(): void {
    this.state.enter('details');
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      void this.load();
    });
  }
  ngOnDestroy(): void {
    this.request++;
    this.routeAnimation?.cancel();
    this.state.closePhoto();
  }
  async load(): Promise<void> {
    this.routeAnimation?.cancel();
    this.routeOpening = false;
    this.routeError = '';
    this.state.closePhoto();
    const request = ++this.request;
    const id = this.route.snapshot.paramMap.get('id')!;
    this.bathroom = null;
    this.reviews = [];
    this.tab = 'overview';
    this.report = null;
    this.failedPhotos.clear();
    this.error = '';
    try {
      const [bathroom, reviews] = await Promise.all([this.state.select(id), this.api.get<Review[]>('/bathrooms/' + id + '/reviews')]);
      if (request !== this.request || this.destroyRef.destroyed) return;
      this.bathroom = bathroom;
      this.reviews = reviews;
    } catch (error) {
      if (request === this.request) this.error = this.api.error(error);
    } finally {
      if (request === this.request && !this.destroyRef.destroyed) {
        this.changeDetector.markForCheck();
        this.state.panelReady.update((value) => value + 1);
      }
    }
  }
  chooseTab(tab: 'overview' | 'photos' | 'reviews'): void {
    if (tab !== 'photos') this.state.closePhoto();
    this.tab = tab;
    requestAnimationFrame(() => {
      if (this.destroyRef.destroyed) return;
      const content = this.element.nativeElement.querySelector<HTMLElement>('[role="tabpanel"]');
      const panel = this.element.nativeElement.closest<HTMLElement>('.workspace-content');
      const tabs = this.element.nativeElement.querySelector<HTMLElement>('[role="tablist"]');
      if (content && panel && tabs) panel.scrollTop += content.getBoundingClientRect().top - panel.getBoundingClientRect().top - tabs.offsetHeight;
    });
  }
  tabKeydown(event: KeyboardEvent, index: number): void {
    const tabs = ['overview', 'photos', 'reviews'] as const;
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!delta && !['Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + delta + 3) % 3;
    this.chooseTab(tabs[next]);
    (event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
  }
  get photo(): number {
    const view = this.state.photoView();
    return view && view.bathroomId === this.bathroom?.id ? view.index : this.state.photoIndexes.get(this.bathroom?.id || '') || 0;
  }
  get displayedReviews(): Review[] {
    return this.tab === 'overview' ? this.reviews.slice(0, 2) : this.reviews;
  }
  openViewer(index: number, event?: MouseEvent): void {
    if (this.bathroom) this.state.openPhoto(this.bathroom, index, event?.currentTarget instanceof HTMLElement ? event.currentTarget : undefined);
  }
  async openRoute(event: MouseEvent): Promise<void> {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (this.routeOpening || !this.bathroom) return;
    this.state.closePhoto();
    this.routeOpening = true;
    this.routeError = '';
    const id = this.bathroom.id;
    const request = this.request;
    let animation: Animation | undefined;
    try {
      const panel = this.element.nativeElement.closest<HTMLElement>('.workspace-content');
      const workspace = panel?.closest<HTMLElement>('.map-workspace');
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (panel && workspace && !reduced && getComputedStyle(workspace).getPropertyValue('--workspace-split-active').trim() === '1') {
        const tokens = getComputedStyle(document.documentElement);
        animation = panel.animate(
          [
            { transform: getComputedStyle(panel).transform, zIndex: tokens.getPropertyValue('--layer-exploration-motion').trim() },
            { transform: 'translateX(-100%)', zIndex: tokens.getPropertyValue('--layer-exploration-motion').trim() }
          ],
          { duration: motionDurationMilliseconds(tokens.getPropertyValue('--motion-panel-duration')), easing: tokens.getPropertyValue('--motion-panel-easing').trim(), fill: 'forwards' }
        );
        this.routeAnimation = animation;
        await animation.finished;
      }
      if (this.destroyRef.destroyed || request !== this.request) return;
      if (!(await this.router.navigate(['/banheiros', id, 'rota']))) this.routeError = 'Não foi possível abrir a rota. Tente novamente.';
    } catch {
      if (!this.destroyRef.destroyed && request === this.request) this.routeError = 'Não foi possível abrir a rota. Tente novamente.';
    } finally {
      animation?.cancel();
      if (this.routeAnimation === animation) this.routeAnimation = undefined;
      if (!this.destroyRef.destroyed && request === this.request) {
        this.routeOpening = false;
        this.changeDetector.markForCheck();
      }
    }
  }
}
