import { Injectable, inject } from '@angular/core';
import { BathroomReviewService } from './bathroom-review.service';
import { ContentImageUploadService } from '../../image/service/content-image-upload.service';
import { apiError } from '../../../core/http/api-error';
import type { BathroomReviewInput } from '../model/bathroom-review-input.model';
import type { BathroomReviewSubmissionResult } from '../model/bathroom-review-submission.model';

@Injectable()
export class BathroomReviewSubmissionService {
  private readonly reviews = inject(BathroomReviewService);
  private readonly images = inject(ContentImageUploadService);
  private pending: Promise<BathroomReviewSubmissionResult> | null = null;

  send(bathroomId: string, editId: string, input: BathroomReviewInput, file: File | null): Promise<BathroomReviewSubmissionResult> {
    if (this.pending) return this.pending;
    this.pending = this.perform(bathroomId, editId, input, file).finally(() => (this.pending = null));
    return this.pending;
  }

  private async perform(bathroomId: string, editId: string, input: BathroomReviewInput, file: File | null): Promise<BathroomReviewSubmissionResult> {
    const contribution = await this.reviews.save(bathroomId, editId, input);
    let warning = '';
    if (file) {
      try {
        await this.images.uploadReviewPhoto(bathroomId, contribution.id, file);
      } catch (error) {
        warning = 'Avaliação salva. A foto não foi enviada: ' + apiError(error);
      }
    }
    return { warning };
  }
}
