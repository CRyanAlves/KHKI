import { BathroomDetails } from '../../../../domain/bathrooms/bathroom.model';
import { OBSERVED_ACCESSIBILITY } from '../../../../domain/bathrooms/bathroom-details';

export type BathroomSearchAccessibilityResource = (typeof OBSERVED_ACCESSIBILITY)[number]['key'];
export interface BathroomSearchFilters {
  audience: '' | Exclude<BathroomDetails['audience'], 'UNKNOWN'>;
  charge: '' | 'YES' | 'NO';
  accessible: boolean;
  resources: BathroomSearchAccessibilityResource[];
  categories: string[];
  items: string[];
  radius: number;
}
export interface BathroomSearchFilterTag {
  key: string;
  label: string;
}
export const FILTER_DISTANCES = [0, 500, 1000, 3000] as const;
