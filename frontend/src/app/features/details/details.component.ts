import { ChangeDetectorRef, Component, DestroyRef, OnDestroy, OnInit, ViewEncapsulation, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ExplorationState } from '../workspace/exploration-state.service';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Bathroom, Review, ACCESS_LABELS, ITEM_LABELS, TargetType } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';
import { ReportComponent } from '../../shared/report.component';

import { SkeletonComponent } from '../../shared/skeleton.component';

@Component({ selector: 'app-details', imports: [SkeletonComponent, RouterLink, DatePipe, DecimalPipe, IconComponent, ReportComponent], templateUrl: './details.component.html', styleUrl: '../../../styles/workspace-details.scss', encapsulation: ViewEncapsulation.None })
export class DetailsComponent implements OnInit, OnDestroy {
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  readonly state = inject(ExplorationState);
  private readonly destroyRef = inject(DestroyRef);
  private request = 0;
  readonly auth = inject(AuthService);
  bathroom: Bathroom | null = null;
  reviews: Review[] = [];
  error = '';
  photo = 0;
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
    this.savePhoto();
  }
  private savePhoto(): void {
    if (this.bathroom) this.state.photoIndexes.set(this.bathroom.id, this.photo);
  }
  async load(): Promise<void> {
    this.savePhoto();
    const request = ++this.request;
    const id = this.route.snapshot.paramMap.get('id')!;
    this.bathroom = null;
    this.reviews = [];
    this.photo = 0;
    this.error = '';
    try {
      const [bathroom, reviews] = await Promise.all([this.state.select(id), this.api.get<Review[]>('/bathrooms/' + id + '/reviews')]);
      if (request !== this.request || this.destroyRef.destroyed) return;
      this.bathroom = bathroom;
      this.reviews = reviews;
      this.photo = Math.min(this.state.photoIndexes.get(id) || 0, Math.max(0, (bathroom?.photoIds.length || 1) - 1));
    } catch (error) {
      if (request === this.request) this.error = this.api.error(error);
    } finally {
      this.changeDetector.markForCheck();
      this.state.panelReady.update((value) => value + 1);
    }
  }
}
