import { Injectable, inject } from '@angular/core';
import { ContentModerationApiService } from './content-moderation-api.service';
import type { ModerationDetail, Status } from '../../../domain/moderation/moderation.model';
import type { ModerationQueueItem, ModerationQueueRow, ModerationReport } from '../model/moderation-queue.model';

@Injectable({ providedIn: 'root' })
export class ContentModerationWorkflowService {
  private readonly moderation = inject(ContentModerationApiService);

  async loadQueue(status: Status, resolved: boolean): Promise<{ items: ModerationQueueItem[]; reports: ModerationReport[] }> {
    const [items, reports] = await Promise.all([this.moderation.queue(status), this.moderation.reports(resolved)]);
    return { items, reports };
  }

  async inspect(row: ModerationQueueRow): Promise<{ detail: ModerationDetail; report: ModerationReport | null }> {
    const [detail, report] = await Promise.all([this.moderation.details(row.type, row.targetId), row.report ? this.moderation.report(row.id) : Promise.resolve(null)]);
    return { detail, report };
  }

  async recordDecision(row: ModerationQueueRow, detail: ModerationDetail, action: Status | 'KEEP', reason: string, duplicateOfId: string): Promise<void> {
    if (row.report) await this.moderation.resolveReport(row.id, { reason, expectedVersion: row.report.version, status: action === 'KEEP' ? null : action, contentVersion: detail.version });
    else await this.moderation.decide(row.type, row.targetId, { status: action, reason, expectedVersion: detail.version, duplicateOfId: action === 'REJECTED' ? duplicateOfId || null : null });
  }
}
