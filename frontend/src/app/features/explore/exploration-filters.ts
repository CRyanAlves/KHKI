import { Bathroom, BathroomDetails, ITEM_LABELS, Location, MapArea } from '../../core/models';
import { AUDIENCE_LABELS, OBSERVED_ACCESSIBILITY } from '../../core/bathroom-details';
import { distanceMeters, validPoint } from '../../core/navigation-geometry';

export type AccessibilityResource = (typeof OBSERVED_ACCESSIBILITY)[number]['key'];
export interface ExplorationFilters {
  audience: '' | Exclude<BathroomDetails['audience'], 'UNKNOWN'>;
  charge: '' | 'YES' | 'NO';
  accessible: boolean;
  resources: AccessibilityResource[];
  categories: string[];
  items: string[];
  radius: number;
}
export interface ActiveFilter {
  key: string;
  label: string;
}
export const FILTER_DISTANCES = [0, 500, 1000, 3000] as const;
export function emptyFilters(): ExplorationFilters {
  return { audience: '', charge: '', accessible: false, resources: [], categories: [], items: [], radius: 0 };
}
export function copyFilters(filters: ExplorationFilters): ExplorationFilters {
  return { ...filters, resources: [...filters.resources], categories: [...filters.categories], items: [...filters.items] };
}
export function filterBathrooms(bathrooms: Bathroom[], filters: ExplorationFilters, reference: Location | null, area: MapArea | null): Bathroom[] {
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
export function activeFilters(filters: ExplorationFilters): ActiveFilter[] {
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
