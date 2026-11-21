import type { TargetType } from '../../../domain/moderation/moderation.model';

export interface ContentReportTarget {
  type: TargetType;
  id: string;
}
