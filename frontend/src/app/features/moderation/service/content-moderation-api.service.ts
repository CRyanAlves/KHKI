import type { ModerationDecision, ReportResolution } from '../model/moderation-decision.model';
import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../core/http/api.service';
import { NearbyResult } from '../../../domain/bathrooms/bathroom.model';
import { ModerationDetail, TargetType } from '../../../domain/moderation/moderation.model';
import { ModerationAudit, ModerationQueueItem, ModerationReport } from '../model/moderation-queue.model';

@Injectable({ providedIn: 'root' })
export class ContentModerationApiService {
  private readonly api = inject(ApiService);

  queue(status: string): Promise<ModerationQueueItem[]> {
    return this.api.get<ModerationQueueItem[]>('/admin/queue/details', { status });
  }

  reports(resolved: boolean): Promise<ModerationReport[]> {
    return this.api.get<ModerationReport[]>('/admin/reports', { resolved: String(resolved) });
  }

  details(type: TargetType, id: string): Promise<ModerationDetail> {
    return this.api.get<ModerationDetail>('/admin/content/' + type + '/' + id);
  }

  report(id: string): Promise<ModerationReport> {
    return this.api.get<ModerationReport>('/admin/reports/' + id);
  }

  history(type: TargetType, id: string): Promise<ModerationAudit[]> {
    return this.api.get<ModerationAudit[]>('/admin/content/' + type + '/' + id + '/history');
  }

  nearby(bathroomId: string, radius: number | null): Promise<NearbyResult> {
    return this.api.get<NearbyResult>('/admin/bathrooms/' + bathroomId + '/nearby', radius === null ? {} : { radiusMeters: String(radius) });
  }

  decide(type: TargetType, id: string, decision: ModerationDecision): Promise<unknown> {
    return this.api.post('/admin/content/' + type + '/' + id + '/decision', decision);
  }

  resolveReport(id: string, resolution: ReportResolution): Promise<unknown> {
    return this.api.post('/admin/reports/' + id + '/resolve', resolution);
  }
}
