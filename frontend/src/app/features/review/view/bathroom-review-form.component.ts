import { apiError } from '../../../core/http/api-error';
import { UserContributionsApiService } from '../../user/contributions/service/user-contributions-api.service';
import { BathroomReviewSubmissionService } from '../service/bathroom-review-submission.service';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ExplorationState } from '../../../layout/exploration-workspace/exploration-state.service';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { validatePhoto } from '../../../shared/validators/photo-validation';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';

@Component({
  selector: 'app-review',
  providers: [BathroomReviewSubmissionService],
  imports: [SkeletonComponent, FormsModule, RouterLink, IconComponent],
  templateUrl: './bathroom-review-form.component.html',
  styleUrl: './bathroom-review-form.component.scss'
})
export class BathroomReviewFormComponent implements OnInit, OnDestroy {
  private readonly contributions = inject(UserContributionsApiService);
  private readonly submission = inject(BathroomReviewSubmissionService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly exploration = inject(ExplorationState);
  private readonly route = inject(ActivatedRoute);
  loading = true;
  id = '';
  name = '';
  editId = '';
  cleanliness = 0;
  structure = 0;
  comment = '';
  file: File | null = null;
  previewUrl = '';
  photoError = '';
  readonly scores = [1, 2, 3, 4, 5];
  busy = false;
  error = '';
  sent = false;
  warning = '';
  async ngOnInit(): Promise<void> {
    this.exploration.enter('review');
    this.id = this.route.snapshot.paramMap.get('id')!;
    this.editId = this.route.snapshot.queryParamMap.get('edit') || '';
    try {
      this.name = (await this.exploration.select(this.id))?.name || '';
      if (this.editId) {
        const review = await this.contributions.review(this.editId);
        this.cleanliness = review.cleanliness;
        this.structure = review.structure;
        this.comment = review.comment || '';
      }
    } catch (error) {
      this.error = apiError(error);
    } finally {
      this.loading = false;
      this.changeDetector.markForCheck();
      this.exploration.panelReady.update((value) => value + 1);
    }
  }
  ratingLabel(score: number): string {
    return score ? score + ' de 5 · ' + ['Muito ruim', 'Ruim', 'Regular', 'Boa', 'Excelente'][score - 1] : 'Selecione uma nota de 1 a 5.';
  }
  choose(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.photoError = validatePhoto(file) || '';
    if (this.photoError) return;
    this.removePhoto();
    this.file = file;
    this.previewUrl = URL.createObjectURL(file);
  }
  removePhoto(): void {
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = '';
    this.file = null;
    this.photoError = '';
  }
  ngOnDestroy(): void {
    this.removePhoto();
  }
  async submit(): Promise<void> {
    if (this.busy || this.sent || !this.cleanliness || !this.structure) return;
    this.busy = true;
    this.error = '';
    try {
      const body = { cleanliness: this.cleanliness, structure: this.structure, comment: this.comment };
      const result = await this.submission.send(this.id, this.editId, body, this.file);
      this.warning = result.warning;
      this.sent = true;
    } catch (error) {
      this.error = apiError(error);
    } finally {
      this.changeDetector.markForCheck();
      this.busy = false;
    }
  }
}
