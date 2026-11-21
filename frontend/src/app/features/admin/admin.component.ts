import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../core/api.service';
import { Bathroom, Review, AuditEntry, ModerationDetail, Contribution, Report, Status, STATUS_LABELS, TargetType, ACCESS_LABELS, ITEM_LABELS, REPORT_LABELS, TYPE_LABELS } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';

@Component({ selector: 'app-admin', imports: [FormsModule, DatePipe, IconComponent], templateUrl: './admin.component.html' })
export class AdminComponent implements OnInit {
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly api = inject(ApiService); readonly labels = STATUS_LABELS; readonly accessLabels = ACCESS_LABELS; readonly itemLabels = ITEM_LABELS; readonly reportLabels = REPORT_LABELS; readonly typeLabels = TYPE_LABELS;
  items: Contribution[] = []; reports: Report[] = []; audits: AuditEntry[] = []; status: Status = 'PENDING'; detail: ModerationDetail | null = null; selected: { type: TargetType; id: string } | null = null; reason = ''; error = ''; message = ''; busy = false;
  get bathroomDetail(): Bathroom | null { return this.selected?.type === 'BATHROOM' && this.detail ? this.detail.content as Bathroom : null; }
  get reviewDetail(): Review | null { return this.selected?.type === 'REVIEW' && this.detail ? this.detail.content as Review : null; }
  can(status: Status): boolean { const current = this.detail?.contribution.status; return status === 'APPROVED' ? current === 'PENDING' || current === 'HIDDEN' : status === 'REJECTED' ? current === 'PENDING' : status === 'HIDDEN' ? current === 'APPROVED' : ['APPROVED', 'HIDDEN', 'REJECTED'].includes(current || ''); }
  ngOnInit(): void { void this.load(); }
  async load(): Promise<void> { this.error = ''; try { const [items, reports, audits] = await Promise.all([this.api.get<Contribution[]>('/admin/queue', { status: this.status }), this.api.get<Report[]>('/admin/reports'), this.api.get<AuditEntry[]>('/admin/audit')]); this.items = items; this.reports = reports; this.audits = audits; } catch (error) { this.error = this.api.error(error); } finally { this.changeDetector.markForCheck(); } }
  async inspect(type: TargetType, id: string): Promise<void> { this.selected = { type, id }; this.detail = null; this.reason = ''; try { this.detail = await this.api.get<ModerationDetail>('/admin/content/' + type + '/' + id); } catch (error) { this.error = this.api.error(error); } finally { this.changeDetector.markForCheck(); } }
  async decide(status: Status): Promise<void> { if (!this.selected || !this.reason.trim()) { this.error = 'Registre um motivo para a decisão.'; return; } this.busy = true; try { await this.api.post('/admin/content/' + this.selected.type + '/' + this.selected.id + '/decision', { status, reason: this.reason }); this.selected = null; this.detail = null; this.message = 'Decisão registrada com responsável, data e motivo.'; await this.load(); } catch (error) { this.error = this.api.error(error); } finally { this.changeDetector.markForCheck(); this.busy = false; } }
  async resolve(id: string): Promise<void> { if (!this.reason.trim()) { this.error = 'Informe o motivo antes de encerrar a denúncia.'; return; } try { await this.api.post('/admin/reports/' + id + '/resolve', { reason: this.reason }); this.message = 'Denúncia encerrada e registrada no histórico.'; await this.load(); } catch (error) { this.error = this.api.error(error); } finally { this.changeDetector.markForCheck(); } }
}
