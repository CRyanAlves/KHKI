import { Bathroom } from '../bathrooms/bathroom.model';
import { Review } from '../reviews/review.model';

export type Status = 'PENDING' | 'NEEDS_INFORMATION' | 'APPROVED' | 'REJECTED' | 'HIDDEN' | 'REMOVED';

export type TargetType = 'BATHROOM' | 'REVIEW';

export interface Contribution {
  id: string;
  type: TargetType;
  title: string;
  status: Status;
  reason: string | null;
  createdAt: string;
  bathroomId: string;
}

export interface Report {
  id: string;
  targetType: TargetType;
  targetId: string;
  reason: string;
  createdAt: string;
}

export interface ModerationDetail {
  contribution: Contribution;
  content: Bathroom | Review | Contribution;
  author: string;
  version: number;
  bathroom: Bathroom;
  photos: { id: string }[];
}

export interface AuditEntry {
  id: string;
  targetType: TargetType;
  targetId: string;
  moderatorId: string;
  decision: Status;
  reason: string;
  createdAt: string;
}

export const STATUS_LABELS: Record<Status, string> = { PENDING: 'Em análise', NEEDS_INFORMATION: 'Aguardando informações', APPROVED: 'Aprovado', REJECTED: 'Rejeitado', HIDDEN: 'Oculto', REMOVED: 'Removido' };

export const REPORT_LABELS: Record<string, string> = { INCORRECT: 'Informação incorreta', CLOSED: 'Local fechado', PRIVACY: 'Privacidade', INAPPROPRIATE: 'Conteúdo inadequado', SPAM: 'Spam', OTHER: 'Outro motivo' };

export const TYPE_LABELS: Record<TargetType, string> = { BATHROOM: 'Banheiro', REVIEW: 'Avaliação' };
