import { REPORT_LABELS, Status } from '../../../domain/moderation/moderation.model';
import type { ModerationCategory, ModerationQueueItem, ModerationQueueRow, ModerationReport } from '../model/moderation-queue.model';

function normalizeModerationQuery(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

export function createModerationQueueRows(category: ModerationCategory, items: ModerationQueueItem[], reports: ModerationReport[]): ModerationQueueRow[] {
  if (category === 'REPORT')
    return reports.map((report) => ({ id: report.id, type: report.targetType, targetId: report.targetId, title: report.title, author: 'Denúncia pública · autor não coletado', address: report.address, complement: null, category: REPORT_LABELS[report.reason] || report.reason, thumbnailId: null, createdAt: report.createdAt, status: report.resolved ? 'RESOLVED' : 'OPEN', report }));
  return items
    .filter((item) => item.contribution.type === category)
    .map((item) => ({ id: item.contribution.id, type: item.contribution.type, targetId: item.contribution.id, title: item.contribution.title, author: item.author, address: item.address, complement: item.complement, category: item.category, thumbnailId: item.thumbnailId, createdAt: item.contribution.createdAt, status: item.contribution.status }));
}

export function filterModerationQueue(rows: ModerationQueueRow[], query: string, sort: string): ModerationQueueRow[] {
  const normalized = normalizeModerationQuery(query);
  return rows.filter((row) => normalizeModerationQuery([row.title, row.author, row.address, row.complement, row.category].join(' ')).includes(normalized)).sort((left, right) => (sort === 'newest' ? right.createdAt.localeCompare(left.createdAt) : left.createdAt.localeCompare(right.createdAt)));
}

export function canModerateContent(status: Status, current: Status | undefined): boolean {
  return status === 'APPROVED' ? ['PENDING', 'NEEDS_INFORMATION', 'HIDDEN'].includes(current || '') : status === 'REJECTED' ? ['PENDING', 'NEEDS_INFORMATION'].includes(current || '') : status === 'NEEDS_INFORMATION' ? ['PENDING', 'NEEDS_INFORMATION'].includes(current || '') : status === 'HIDDEN' ? current === 'APPROVED' : ['APPROVED', 'HIDDEN', 'REJECTED'].includes(current || '');
}
