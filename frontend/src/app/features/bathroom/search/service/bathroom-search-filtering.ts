import { Bathroom, ITEM_LABELS } from '../../../../domain/bathrooms/bathroom.model';
import { Location, MapArea } from '../../../../domain/location/location.model';
import { AUDIENCE_LABELS, OBSERVED_ACCESSIBILITY } from '../../../../domain/bathrooms/bathroom-details';
import { distanceMeters, validPoint } from '../../../../shared/geo/navigation-geometry';
import { BathroomSearchFilters, BathroomSearchFilterTag } from '../model/bathroom-search-filters.model';

export function emptyFilters(): BathroomSearchFilters {
  return { audience: '', charge: '', accessible: false, resources: [], categories: [], items: [], radius: 0 };
}
export function copyFilters(filters: BathroomSearchFilters): BathroomSearchFilters {
  return { ...filters, resources: [...filters.resources], categories: [...filters.categories], items: [...filters.items] };
}
export function filterBathrooms(bathrooms: Bathroom[], filters: BathroomSearchFilters, reference: Location | null, area: MapArea | null): Bathroom[] {
  return bathrooms.filter((bathroom) => {
    const details = bathroom.details;
    if (filters.audience && details?.audience !== filters.audience) return false;
    if (filters.charge && details?.charge !== filters.charge) return false;
    if (filters.accessible && bathroom.accessible !== true) return false;
    if (filters.resources.some((resource) => details?.[resource] !== true)) return false;
    if (filters.categories.length && !filters.categories.includes(bathroom.category)) return false;
    if (filters.items.some((item) => !bathroom.items.includes(item))) return false;
    if (area && !(bathroom.latitude <= area.north && bathroom.latitude >= area.south && (area.west <= area.east ? bathroom.longitude >= area.west && bathroom.longitude <= area.east : bathroom.longitude >= area.west || bathroom.longitude <= area.east))) return false;
    if (filters.radius && (!reference || !validPoint(reference) || !validPoint({ lat: bathroom.latitude, lng: bathroom.longitude }) || distanceMeters(reference, { lat: bathroom.latitude, lng: bathroom.longitude }) > filters.radius)) return false;
    return true;
  });
}
export function activeFilters(filters: BathroomSearchFilters): BathroomSearchFilterTag[] {
  return [
    ...(filters.audience ? [{ key: 'audience', label: AUDIENCE_LABELS[filters.audience] }] : []),
    ...(filters.charge ? [{ key: 'charge', label: filters.charge === 'NO' ? 'Gratuito' : 'Pago' }] : []),
    ...(filters.accessible ? [{ key: 'accessible', label: 'Acessível' }] : []),
    ...filters.resources.map((resource) => ({ key: 'resources:' + resource, label: OBSERVED_ACCESSIBILITY.find((option) => option.key === resource)!.label })),
    ...filters.categories.map((category) => ({ key: 'categories:' + category, label: category })),
    ...filters.items.map((item) => ({ key: 'items:' + item, label: ITEM_LABELS[item] })),
    ...(filters.radius ? [{ key: 'radius', label: 'Até ' + (filters.radius < 1000 ? filters.radius + ' m' : filters.radius / 1000 + ' km') }] : [])
  ];
}
