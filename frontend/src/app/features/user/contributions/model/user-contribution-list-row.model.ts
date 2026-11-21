import type { Contribution } from '../../../../domain/moderation/moderation.model';

export interface UserContributionListRow extends Contribution {
  name: string;
  decision: string;
  label: string;
}
