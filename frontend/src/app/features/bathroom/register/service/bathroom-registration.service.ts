import type { BathroomRegistrationPhotoDraft } from '../model/bathroom-registration-photo-draft.model';
import { apiError } from '../../../../core/http/api-error';
import { ContentImageUploadService } from '../../../image/service/content-image-upload.service';
import { BathroomApiService } from '../../service/bathroom-api.service';
import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { BathroomInput } from '../../../../domain/bathrooms/bathroom.model';
import { Contribution } from '../../../../domain/moderation/moderation.model';

@Injectable()
export class BathroomRegistrationService {
  private readonly images = inject(ContentImageUploadService);
  private readonly bathrooms = inject(BathroomApiService);
  private request: Promise<boolean> | null = null;
  createdId = '';
  uncertain = false;
  uncertainUploads = false;
  send(form: BathroomInput, editId: string, photos: BathroomRegistrationPhotoDraft[]): Promise<boolean> {
    if (this.request) return this.request;
    this.request = this.perform(form, editId, photos).finally(() => {
      this.request = null;
    });
    return this.request;
  }
  private async perform(form: BathroomInput, editId: string, photos: BathroomRegistrationPhotoDraft[]): Promise<boolean> {
    if (this.uncertain || this.uncertainUploads) throw new Error('Confira Minhas contribuições antes de iniciar outro envio: a resposta anterior não foi confirmada.');
    if (!this.createdId) {
      const input: BathroomInput = {
        name: form.name,
        address: form.address,
        complement: form.complement,
        category: form.category,
        latitude: form.latitude,
        longitude: form.longitude,
        access: form.access,
        accessDetails: form.accessDetails,
        hours: form.hours,
        accessible: form.accessible,
        items: [...form.items].sort(),
        details: form.details ? { ...form.details, bathroomTypes: [...form.details.bathroomTypes].sort(), lastVisited: form.details.lastVisited || null } : undefined
      };
      let contribution: Contribution;
      try {
        contribution = await this.bathrooms.save(input, editId);
      } catch (error) {
        if (error instanceof HttpErrorResponse && error.status > 0 && error.status < 500) {
          this.uncertain = false;
          throw error;
        }
        this.uncertain = true;
        throw error;
      }
      this.createdId = contribution.id;
      this.uncertain = false;
    }
    for (const photo of photos.filter((photo) => !photo.uploaded)) {
      photo.error = '';
      try {
        await this.images.uploadRegistrationPhoto(this.createdId, photo.file);
        photo.uploaded = true;
        photo.uncertain = false;
      } catch (error) {
        photo.uncertain = !(error instanceof HttpErrorResponse) || error.status === 0 || error.status >= 500;
        photo.error = photo.uncertain ? 'Recebimento não confirmado. Confira as fotos em Minhas contribuições antes de enviar novamente.' : apiError(error);
      }
    }
    this.uncertainUploads = photos.some((photo) => photo.uncertain);
    return photos.every((photo) => photo.uploaded);
  }
}
