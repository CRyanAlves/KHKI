import type { Location } from '../../../domain/location/location.model';

export interface AddressSuggestion {
  label: string;
  detail: string;
  position: Location;
}
