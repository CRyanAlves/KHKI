import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ExplorationState } from '../workspace/exploration-state.service';
import { ApiService } from '../../core/api.service';
import { Contribution, Review } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';
import { validatePhoto } from '../../shared/photo-validation';
import { SkeletonComponent } from '../../shared/skeleton.component';

@Component({
  selector: 'app-review',
  imports: [SkeletonComponent, FormsModule, RouterLink, IconComponent],
  templateUrl: './review.component.html',
  styleUrl: './review.component.scss'
})
export class ReviewComponent implements OnInit, OnDestroy {
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly exploration = inject(ExplorationState);
  private readonly api = inject(ApiService);
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
        const review = await this.api.get<Review>('/me/contributions/REVIEW/' + this.editId);
        this.cleanliness = review.cleanliness;
        this.structure = review.structure;
        this.comment = review.comment || '';
      }
    } catch (error) {
      this.error = this.api.error(error);
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
      const contribution = this.editId ? await this.api.put<Contribution>('/reviews/' + this.editId, body) : await this.api.post<Contribution>('/bathrooms/' + this.id + '/reviews', body);
      if (this.file) {
        const data = new FormData();
        data.append('file', this.file);
        try {
          await this.api.post('/bathrooms/' + this.id + '/photos?reviewId=' + contribution.id, data);
        } catch (error) {
          this.warning = 'Avaliação salva. A foto não foi enviada: ' + this.api.error(error);
        }
      }
      this.sent = true;
    } catch (error) {
      this.error = this.api.error(error);
    } finally {
      this.changeDetector.markForCheck();
      this.busy = false;
    }
  }
}
