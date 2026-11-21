import { BathroomMetadataComponent } from '../../shared/bathroom-metadata.component';
import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../core/api.service';
import { Bathroom, Review, ModerationDetail, Status, STATUS_LABELS, TargetType, ACCESS_LABELS, ITEM_LABELS, REPORT_LABELS, TYPE_LABELS } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';
import { MapComponent } from '../../shared/map.component';
import { ModerationAudit, ModerationCategory, ModerationQueueItem, ModerationReport, NearbyCandidate, NearbyResult, QueueRow } from './admin.models';

import { SkeletonComponent } from '../../shared/skeleton.component';

@Component({ selector: 'app-admin', imports: [BathroomMetadataComponent, SkeletonComponent, FormsModule, DatePipe, DecimalPipe, IconComponent, MapComponent], templateUrl: './admin.component.html' })
export class AdminComponent implements OnInit, OnDestroy {
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly api = inject(ApiService);
  private readonly sidebarViewport = window.matchMedia('(max-width: ' + getComputedStyle(document.documentElement).getPropertyValue('--breakpoint-mobile').trim() + ')');
  private readonly updateSidebarViewport = () => {
    this.sidebarCollapsed = this.sidebarViewport.matches;
    this.changeDetector.markForCheck();
  };
  @ViewChild('confirmation') confirmation!: ElementRef<HTMLDialogElement>;
  @ViewChild('lightbox') lightbox!: ElementRef<HTMLDialogElement>;
  @ViewChild('queueScroll') queueScroll?: ElementRef<HTMLElement>;
  @ViewChild('historyPanel') historyPanel?: ElementRef<HTMLDetailsElement>;
  readonly labels = STATUS_LABELS;
  readonly accessLabels = ACCESS_LABELS;
  readonly itemLabels = ITEM_LABELS;
  readonly reportLabels = REPORT_LABELS;
  readonly typeLabels = TYPE_LABELS;
  readonly categories: { id: ModerationCategory; label: string; icon: string }[] = [
    { id: 'BATHROOM', label: 'Banheiros', icon: 'Toilet' },
    { id: 'REVIEW', label: 'Avaliações', icon: 'Star' },
    { id: 'REPORT', label: 'Denúncias', icon: 'Flag' }
  ];
  readonly statuses = Object.entries(STATUS_LABELS) as [Status, string][];
  items: ModerationQueueItem[] = [];
  reports: ModerationReport[] = [];
  history: ModerationAudit[] = [];
  category: ModerationCategory = 'BATHROOM';
  status: Status = 'PENDING';
  reportStatus = 'OPEN';
  query = '';
  sort = 'newest';
  limit = 20;
  selected: QueueRow | null = null;
  detail: ModerationDetail | null = null;
  mapBathrooms: Bathroom[] = [];
  mapSelection = '';
  nearby: NearbyResult | null = null;
  nearbyLoading = false;
  nearbyError = '';
  radius: number | null = null;
  comparison: NearbyCandidate | null = null;
  reason = '';
  duplicateOfId = '';
  error = '';
  message = '';
  loading = true;
  detailLoading = false;
  busy = false;
  historyOpen = false;
  historyLoading = false;
  historyError = '';
  photoId = '';
  conflict = false;
  decisionAction: Status | 'KEEP' | null = null;
  sidebarCollapsed = false;
  private loadSequence = 0;
  private inspectSequence = 0;
  private savedScroll = 0;
  private savedWindowScroll = 0;
  private readonly verification = new Map<string, NearbyResult>();
  ngOnInit(): void {
    this.updateSidebarViewport();
    this.sidebarViewport.addEventListener('change', this.updateSidebarViewport);
    void this.load();
  }
  ngOnDestroy(): void {
    this.sidebarViewport.removeEventListener('change', this.updateSidebarViewport);
  }
  toggleSidebar(): void {
    if (!this.busy) this.sidebarCollapsed = !this.sidebarCollapsed;
  }
  toggleSidebarBlank(event: MouseEvent): void {
    if (event.target instanceof Element && !event.target.closest('button, a, input, select, textarea, summary')) this.toggleSidebar();
  }
  get bathroomDetail(): Bathroom | null {
    return this.selected?.type === 'BATHROOM' && this.detail ? (this.detail.content as Bathroom) : null;
  }
  get reviewDetail(): Review | null {
    return this.selected?.type === 'REVIEW' && this.detail ? (this.detail.content as Review) : null;
  }
  get rows(): QueueRow[] {
    if (this.category === 'REPORT')
      return this.reports.map((report) => ({ id: report.id, type: report.targetType, targetId: report.targetId, title: report.title, author: 'Denúncia pública · autor não coletado', address: report.address, complement: null, category: this.reportLabels[report.reason] || report.reason, thumbnailId: null, createdAt: report.createdAt, status: report.resolved ? 'RESOLVED' : 'OPEN', report }));
    return this.items
      .filter((item) => item.contribution.type === this.category)
      .map((item) => ({ id: item.contribution.id, type: item.contribution.type, targetId: item.contribution.id, title: item.contribution.title, author: item.author, address: item.address, complement: item.complement, category: item.category, thumbnailId: item.thumbnailId, createdAt: item.contribution.createdAt, status: item.contribution.status }));
  }
  get filtered(): QueueRow[] {
    const query = this.normalize(this.query);
    return this.rows.filter((row) => this.normalize([row.title, row.author, row.address, row.complement, row.category].join(' ')).includes(query)).sort((left, right) => (this.sort === 'newest' ? right.createdAt.localeCompare(left.createdAt) : left.createdAt.localeCompare(right.createdAt)));
  }
  count(category: ModerationCategory): number {
    return category === 'REPORT' ? this.reports.length : this.items.filter((item) => item.contribution.type === category).length;
  }
  statusLabel(status: QueueRow['status']): string {
    return status === 'OPEN' ? 'Em aberto' : status === 'RESOLVED' ? 'Encerrada' : this.labels[status];
  }
  verificationLabel(id: string): string {
    const result = this.verification.get(id);
    return !result ? 'Verificação não executada' : result.candidates.some((candidate) => candidate.possibleDuplicate) ? 'Possível duplicidade' : 'Sem candidatos semelhantes neste raio';
  }
  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR');
  }
  can(status: Status): boolean {
    const current = this.detail?.contribution.status;
    return status === 'APPROVED'
      ? ['PENDING', 'NEEDS_INFORMATION', 'HIDDEN'].includes(current || '')
      : status === 'REJECTED'
        ? ['PENDING', 'NEEDS_INFORMATION'].includes(current || '')
        : status === 'NEEDS_INFORMATION'
          ? ['PENDING', 'NEEDS_INFORMATION'].includes(current || '')
          : status === 'HIDDEN'
            ? current === 'APPROVED'
            : ['APPROVED', 'HIDDEN', 'REJECTED'].includes(current || '');
  }
  async load(): Promise<void> {
    const sequence = ++this.loadSequence;
    this.loading = true;
    this.error = '';
    try {
      const [items, reports] = await Promise.all([this.api.get<ModerationQueueItem[]>('/admin/queue/details', { status: this.status }), this.api.get<ModerationReport[]>('/admin/reports', { resolved: String(this.reportStatus === 'RESOLVED') })]);
      if (sequence !== this.loadSequence) return;
      this.items = items;
      this.reports = reports;
    } catch (error) {
      if (sequence === this.loadSequence) this.error = this.api.error(error);
    } finally {
      if (sequence === this.loadSequence) {
        this.loading = false;
        this.changeDetector.markForCheck();
      }
    }
  }
  changeCategory(category: ModerationCategory): void {
    if (this.busy) return;
    this.close();
    this.category = category;
    this.limit = 20;
    this.message = '';
  }
  changeFilter(): void {
    this.close();
    this.limit = 20;
    void this.load();
  }
  close(): void {
    if (this.busy) return;
    ++this.inspectSequence;
    this.selected = null;
    this.detail = null;
    this.comparison = null;
    this.error = '';
    this.changeDetector.detectChanges();
    requestAnimationFrame(() => {
      if (this.queueScroll) this.queueScroll.nativeElement.scrollTop = this.savedScroll;
      window.scrollTo({ top: this.savedWindowScroll });
    });
  }
  async inspect(row: QueueRow): Promise<void> {
    if (this.busy) return;
    if (!this.selected) {
      this.savedScroll = this.queueScroll?.nativeElement.scrollTop || 0;
      this.savedWindowScroll = window.scrollY;
    }
    const sequence = ++this.inspectSequence;
    this.selected = row;
    this.detail = null;
    this.detailLoading = true;
    this.reason = '';
    this.duplicateOfId = '';
    this.error = '';
    this.message = '';
    this.conflict = false;
    this.historyOpen = false;
    this.history = [];
    this.historyError = '';
    this.nearby = null;
    this.nearbyLoading = false;
    this.nearbyError = '';
    this.comparison = null;
    this.mapBathrooms = [];
    try {
      const [detail, report] = await Promise.all([this.api.get<ModerationDetail>('/admin/content/' + row.type + '/' + row.targetId), row.report ? this.api.get<ModerationReport>('/admin/reports/' + row.id) : Promise.resolve(null)]);
      if (sequence !== this.inspectSequence) return;
      this.detail = detail;
      if (report) {
        row.report = report;
        row.status = report.resolved ? 'RESOLVED' : 'OPEN';
      }
      this.mapBathrooms = [detail.bathroom];
      this.mapSelection = '';
      void this.loadHistory(row, sequence);
      if (row.type === 'BATHROOM') void this.checkNearby(sequence);
    } catch (error) {
      if (sequence === this.inspectSequence) this.error = this.api.error(error);
    } finally {
      if (sequence === this.inspectSequence) {
        this.detailLoading = false;
        this.changeDetector.markForCheck();
      }
    }
  }
  async loadHistory(row = this.selected, sequence = this.inspectSequence): Promise<void> {
    if (!row) return;
    this.historyError = '';
    this.historyLoading = true;
    try {
      const history = await this.api.get<ModerationAudit[]>('/admin/content/' + row.type + '/' + row.targetId + '/history');
      if (sequence === this.inspectSequence) this.history = history;
    } catch (error) {
      if (sequence === this.inspectSequence) this.historyError = this.api.error(error);
    } finally {
      if (sequence === this.inspectSequence) this.historyLoading = false;
      this.changeDetector.markForCheck();
    }
  }
  async checkNearby(sequence = this.inspectSequence): Promise<void> {
    const bathroom = this.bathroomDetail;
    if (!bathroom || (this.nearbyLoading && sequence === this.inspectSequence)) return;
    this.nearbyLoading = true;
    this.nearbyError = '';
    this.nearby = null;
    this.comparison = null;
    try {
      const result = await this.api.get<NearbyResult>('/admin/bathrooms/' + bathroom.id + '/nearby', this.radius === null ? {} : { radiusMeters: String(this.radius) });
      if (sequence !== this.inspectSequence) return;
      this.nearby = result;
      this.verification.set(bathroom.id, result);
      this.mapBathrooms = [bathroom, ...result.candidates.map((candidate) => candidate.bathroom)];
    } catch (error) {
      if (sequence === this.inspectSequence) {
        this.nearbyError = this.api.error(error);
        this.verification.delete(bathroom.id);
      }
    } finally {
      if (sequence === this.inspectSequence) {
        this.nearbyLoading = false;
        this.changeDetector.markForCheck();
      }
    }
  }
  compare(id: string): void {
    this.comparison = this.nearby?.candidates.find((candidate) => candidate.bathroom.id === id) || null;
    this.mapSelection = this.comparison?.bathroom.id || '';
  }
  picture(id: string): void {
    this.photoId = id;
    this.lightbox.nativeElement.showModal();
  }
  showHistory(): void {
    this.historyOpen = true;
    this.changeDetector.detectChanges();
    this.historyPanel?.nativeElement.scrollIntoView({ block: 'nearest' });
    this.historyPanel?.nativeElement.querySelector('summary')?.focus({ preventScroll: true });
  }
  requestDecision(action: Status | 'KEEP'): void {
    if (this.busy || this.conflict || !this.detail) return;
    if (!this.reason.trim()) {
      this.error = 'Registre um motivo claro para o autor antes de confirmar a decisão.';
      return;
    }
    this.error = '';
    this.decisionAction = action;
    this.confirmation.nativeElement.showModal();
  }
  get decisionLabel(): string {
    return this.decisionAction === 'KEEP' ? 'Manter conteúdo e encerrar denúncia' : this.decisionAction === 'NEEDS_INFORMATION' ? 'Solicitar informações' : this.decisionAction === 'APPROVED' ? 'Confirmar aprovação' : this.decisionAction === 'REJECTED' ? 'Confirmar rejeição' : this.decisionAction === 'HIDDEN' ? 'Confirmar ocultação' : 'Confirmar remoção definitiva';
  }
  async confirmDecision(): Promise<void> {
    const row = this.selected;
    const detail = this.detail;
    const action = this.decisionAction;
    if (this.busy || !row || !detail || !action) return;
    this.busy = true;
    this.error = '';
    try {
      if (row.report) await this.api.post('/admin/reports/' + row.id + '/resolve', { reason: this.reason, expectedVersion: row.report.version, status: action === 'KEEP' ? null : action, contentVersion: detail.version });
      else await this.api.post('/admin/content/' + row.type + '/' + row.targetId + '/decision', { status: action, reason: this.reason, expectedVersion: detail.version, duplicateOfId: action === 'REJECTED' ? this.duplicateOfId || null : null });
      this.confirmation.nativeElement.close();
      this.detail = await this.api.get<ModerationDetail>('/admin/content/' + row.type + '/' + row.targetId);
      if (row.report) row.report.resolved = true;
      await Promise.all([this.load(), this.loadHistory()]);
      this.message = 'Decisão registrada com responsável, data e motivo.';
      this.reason = '';
      this.duplicateOfId = '';
      this.historyOpen = true;
    } catch (error) {
      this.confirmation.nativeElement.close();
      this.error = this.api.error(error);
      this.conflict = error instanceof HttpErrorResponse && error.status === 409;
    } finally {
      this.busy = false;
      this.decisionAction = null;
      this.changeDetector.markForCheck();
    }
  }
  get surroundingsUrl(): string {
    const bathroom = this.bathroomDetail;
    return bathroom ? 'https://www.openstreetmap.org/?mlat=' + bathroom.latitude + '&mlon=' + bathroom.longitude + '#map=19/' + bathroom.latitude + '/' + bathroom.longitude : '';
  }
}
