import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../core/http/api.service';
import { TargetType } from '../../../domain/moderation/moderation.model';

@Injectable({ providedIn: 'root' })
export class ContentReportService {
  private readonly api = inject(ApiService);

  async create(targetType: TargetType, targetId: string, reason: string): Promise<void> {
    await this.api.get('/auth/csrf');
    await this.api.post('/reports', { targetType, targetId, reason });
  }
}
