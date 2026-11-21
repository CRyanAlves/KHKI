import type { Status } from '../../../domain/moderation/moderation.model';

export interface ModerationDecision {
  status: Status | 'KEEP';
  reason: string;
  expectedVersion: number;
  duplicateOfId: string | null;
}

export interface ReportResolution {
  reason: string;
  expectedVersion: number;
  status: Status | null;
  contentVersion: number;
}
