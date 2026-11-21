import { Bathroom, BathroomInput } from '../../../../domain/bathrooms/bathroom.model';
import { emptyBathroomDetails } from '../../../../domain/bathrooms/bathroom-details';

export function prepareBathroomRegistrationEdit(bathroom: Bathroom): BathroomInput {
  return {
    name: bathroom.name,
    address: bathroom.address,
    complement: bathroom.complement || '',
    category: bathroom.category,
    latitude: bathroom.latitude,
    longitude: bathroom.longitude,
    access: bathroom.access,
    accessDetails: bathroom.accessDetails || '',
    hours: bathroom.hours || '',
    accessible: bathroom.accessible,
    items: [...bathroom.items],
    details: { ...emptyBathroomDetails(bathroom.access), ...bathroom.details, bathroomTypes: [...(bathroom.details?.bathroomTypes || [])] }
  };
}
