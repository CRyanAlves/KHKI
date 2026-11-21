import { AuditEntry, Contribution, Report, Status, TargetType } from '../../core/models';
export type { NearbyCandidate, NearbyResult } from '../../core/models';

export type ModerationCategory = TargetType | 'REPORT';
export interface ModerationQueueItem {
  contribution: Contribution;
  author: string;
  address: string;
  complement: string | null;
  category: string;
  thumbnailId: string | null;
  version: number;
}
export interface ModerationReport extends Report {
  resolved: boolean;
  version: number;
  title: string;
  address: string;
}
export interface ModerationAudit extends AuditEntry {
  moderator: string;
  duplicateOfId: string | null;
}
export interface QueueRow {
  id: string;
  type: TargetType;
  targetId: string;
  title: string;
  author: string;
  address: string;
  complement: string | null;
  category: string;
  thumbnailId: string | null;
  createdAt: string;
  status: Status | 'OPEN' | 'RESOLVED';
  report?: ModerationReport;
}
