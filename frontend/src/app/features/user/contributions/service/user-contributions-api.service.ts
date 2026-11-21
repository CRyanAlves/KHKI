import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../../core/http/api.service';
import { Bathroom } from '../../../../domain/bathrooms/bathroom.model';
import { Contribution } from '../../../../domain/moderation/moderation.model';
import { Review } from '../../../../domain/reviews/review.model';

@Injectable({ providedIn: 'root' })
export class UserContributionsApiService {
  private readonly api = inject(ApiService);

  list(): Promise<Contribution[]> {
    return this.api.get<Contribution[]>('/me/contributions');
  }

  bathroom(id: string): Promise<Bathroom> {
    return this.api.get<Bathroom>('/me/contributions/BATHROOM/' + id);
  }

  review(id: string): Promise<Review> {
    return this.api.get<Review>('/me/contributions/REVIEW/' + id);
  }
}
