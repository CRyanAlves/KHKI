import { Injectable, inject, signal } from '@angular/core';
import { ContentReportService } from './content-report.service';
import { apiError } from '../../../core/http/api-error';
import type { ContentReportTarget } from '../model/content-report-target.model';

@Injectable()
export class ContentReportSubmissionService {
  private readonly reports = inject(ContentReportService);
  readonly reason = signal('INCORRECT');
  readonly message = signal('');
  readonly busy = signal(false);
  readonly sent = signal(false);

  async submit(target: ContentReportTarget): Promise<void> {
    if (this.busy() || this.sent()) return;
    this.busy.set(true);
    try {
      await this.reports.create(target.type, target.id, this.reason());
      this.sent.set(true);
      this.message.set('Obrigado. A denúncia foi recebida para análise.');
    } catch (error) {
      this.message.set(apiError(error));
    } finally {
      this.busy.set(false);
    }
  }
}
