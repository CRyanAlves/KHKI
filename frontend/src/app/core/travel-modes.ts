export const TRAVEL_MODES = [
  { value: 'drive', label: 'Carro', phrase: 'de carro', icon: 'Car', simulationSpeed: 8.33 },
  { value: 'motorcycle', label: 'Moto', phrase: 'de moto', icon: 'Motorbike', simulationSpeed: 8.33 },
  { value: 'bicycle', label: 'Bike', phrase: 'de bicicleta', icon: 'Bike', simulationSpeed: 4.17 },
  { value: 'walk', label: 'A pé', phrase: 'a pé', icon: 'Footprints', simulationSpeed: 1.4 }
] as const;
export type TravelMode = (typeof TRAVEL_MODES)[number]['value'];
export function isTravelMode(value: unknown): value is TravelMode {
  return TRAVEL_MODES.some((mode) => mode.value === value);
}
