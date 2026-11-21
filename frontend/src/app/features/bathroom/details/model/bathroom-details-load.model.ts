import type { Bathroom } from '../../../../domain/bathrooms/bathroom.model';
import type { Review } from '../../../../domain/reviews/review.model';

export interface BathroomDetailsLoad {
  bathroom: Promise<Bathroom>;
  reviews: Promise<Review[]>;
}
