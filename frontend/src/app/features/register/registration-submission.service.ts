import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../core/api.service';
import { BathroomInput, Contribution } from '../../core/models';

export interface PhotoDraft { file: File; preview: string; key: string; uploaded: boolean; error: string; uncertain?: boolean }

@Injectable()
export class RegistrationSubmissionService {
  private readonly api = inject(ApiService);
  private readonly key = crypto.randomUUID();
  createdId = '';
  uncertain = false;
  async send(form: BathroomInput, editId: string, photos: PhotoDraft[]): Promise<boolean> {
    if (!this.createdId) {
      const input: BathroomInput = { name: form.name, address: form.address, complement: form.complement, category: form.category, latitude: form.latitude, longitude: form.longitude, access: form.access, accessDetails: form.accessDetails, hours: form.hours, accessible: form.accessible, items: [...form.items].sort(), submissionId: this.key };
      let contribution: Contribution;
      try { contribution = editId ? await this.api.put<Contribution>('/bathrooms/' + editId, input) : await this.api.post<Contribution>('/bathrooms', input); }
      catch (error) { if (error instanceof HttpErrorResponse && error.status > 0 && error.status < 500) { this.uncertain = false; throw error; } this.uncertain = true; try { contribution = await this.api.get<Contribution>('/me/submissions/' + this.key); } catch { throw error; } }
      this.createdId = contribution.id; this.uncertain = false;
    }
    for (const photo of photos.filter(photo => !photo.uploaded)) {
      const body = new FormData(); body.append('file', photo.file); photo.error = '';
      try { await this.api.post('/bathrooms/' + this.createdId + '/photos?submissionId=' + photo.key, body); photo.uploaded = true; photo.uncertain = false; }
      catch (error) { photo.uncertain = !(error instanceof HttpErrorResponse) || error.status === 0 || error.status >= 500; photo.error = photo.uncertain ? 'Recebimento não confirmado. Tente novamente para verificar esta foto antes de removê-la.' : this.api.error(error); }
    }
    return photos.every(photo => photo.uploaded);
  }
}