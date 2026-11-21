import type { BathroomReviewInput } from '../model/bathroom-review-input.model';
import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../core/http/api.service';
import { Contribution } from '../../../domain/moderation/moderation.model';
import { Review } from '../../../domain/reviews/review.model';

@Injectable({ providedIn: 'root' })
export class BathroomReviewService {
  private readonly api = inject(ApiService);

  list(bathroomId: string): Promise<Review[]> {
    return this.api.get<Review[]>('/bathrooms/' + bathroomId + '/reviews');
  }

  save(bathroomId: string, editId: string, input: BathroomReviewInput): Promise<Contribution> {
    return editId ? this.api.put<Contribution>('/reviews/' + editId, input) : this.api.post<Contribution>('/bathrooms/' + bathroomId + '/reviews', input);
  }
}
