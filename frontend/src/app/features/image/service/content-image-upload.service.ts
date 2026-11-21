import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../core/http/api.service';

@Injectable({ providedIn: 'root' })
export class ContentImageUploadService {
  private readonly api = inject(ApiService);

  uploadRegistrationPhoto(bathroomId: string, file: File): Promise<unknown> {
    return this.upload('/bathrooms/' + bathroomId + '/photos?registrationAttachment=true', file);
  }

  uploadReviewPhoto(bathroomId: string, reviewId: string, file: File): Promise<unknown> {
    return this.upload('/bathrooms/' + bathroomId + '/photos?reviewId=' + reviewId, file);
  }

  private upload(path: string, file: File): Promise<unknown> {
    const body = new FormData();
    body.append('file', file);
    return this.api.post(path, body);
  }
}
