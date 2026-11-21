import type { Bathroom } from '../../../../domain/bathrooms/bathroom.model';
import type { AddressSuggestion } from '../../../../integrations/maps/model/address-suggestion.model';

export interface BathroomSearchSuggestion {
  label: string;
  detail: string;
  bathroom?: Bathroom;
  address?: AddressSuggestion;
}
