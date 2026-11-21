import { Contribution, STATUS_LABELS, Status, TargetType } from '../../../../domain/moderation/moderation.model';
import type { UserContributionListRow } from '../model/user-contribution-list-row.model';

const IDENTIFIER = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/giu;

function contributionName(item: Contribution): string {
  const name = item.title
    .replace(/^(?:(?:foto|avaliação|cadastro|banheiro)\s*:\s*)+/iu, '')
    .replace(IDENTIFIER, '')
    .trim();
  return name || 'Local relacionado ao envio';
}

function contributionReason(item: Contribution): string {
  const reason = (item.reason || '')
    .replace(IDENTIFIER, '')
    .replace(/\s+([.,;:])/gu, '$1')
    .replace(/\s+/gu, ' ')
    .trim();
  if (item.status === 'APPROVED' && /^(?:cadastro|foto|avaliação)?\s*aprova(?:do|da)\.?$/iu.test(reason)) return '';
  return reason;
}

export function filterUserContributions(items: Contribution[], type: TargetType | '', status: Status | '', order: string): UserContributionListRow[] {
  return items
    .filter((item) => (!type || item.type === type) && (!status || item.status === status))
    .sort((first, second) => (Date.parse(first.createdAt) - Date.parse(second.createdAt)) * (order === 'oldest' ? 1 : -1))
    .map((item) => ({ ...item, name: contributionName(item), decision: contributionReason(item), label: item.status === 'REJECTED' ? 'Não aprovado' : STATUS_LABELS[item.status] }));
}
