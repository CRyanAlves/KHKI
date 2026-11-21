import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../core/http/api.service';
import { Bathroom, BathroomInput, NearbyResult } from '../../../domain/bathrooms/bathroom.model';
import { Contribution } from '../../../domain/moderation/moderation.model';

@Injectable({ providedIn: 'root' })
export class BathroomApiService {
  private readonly api = inject(ApiService);

  search(parameters: Record<string, string> = {}): Promise<Bathroom[]> {
    return this.api.get<Bathroom[]>('/bathrooms', parameters);
  }

  details(id: string): Promise<Bathroom> {
    return this.api.get<Bathroom>('/bathrooms/' + id);
  }

  nearby(parameters: Record<string, string>): Promise<NearbyResult> {
    return this.api.get<NearbyResult>('/bathrooms/nearby', parameters);
  }

  save(input: BathroomInput, editId: string): Promise<Contribution> {
    return editId ? this.api.put<Contribution>('/bathrooms/' + editId, input) : this.api.post<Contribution>('/bathrooms', input);
  }
}
