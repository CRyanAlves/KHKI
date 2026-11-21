import { Injectable, inject } from '@angular/core';
import { BathroomApiService } from '../../service/bathroom-api.service';
import { BathroomReviewService } from '../../../review/service/bathroom-review.service';
import type { BathroomDetailsLoad } from '../model/bathroom-details-load.model';

@Injectable({ providedIn: 'root' })
export class BathroomDetailsService {
  private readonly bathrooms = inject(BathroomApiService);
  private readonly reviews = inject(BathroomReviewService);

  startLoad(bathroomId: string): BathroomDetailsLoad {
    return { bathroom: this.bathrooms.details(bathroomId), reviews: this.reviews.list(bathroomId) };
  }
}
