export type Access = 'FREE' | 'CUSTOMERS' | 'PAID' | 'OTHER';

export interface BathroomDetails {
  audience: 'PUBLIC' | 'CUSTOMERS' | 'AUTHORIZATION' | 'OTHER' | 'UNKNOWN';
  charge: 'YES' | 'NO' | 'UNKNOWN';
  feeAmount: number | null;
  bathroomTypes: string[];
  stepFreeAccess: boolean | null;
  elevator: boolean | null;
  adaptedCabin: boolean | null;
  grabBars: boolean | null;
  lastVisited: string | null;
}

export interface Bathroom {
  id: string;
  name: string;
  address: string;
  complement?: string | null;
  category: string;
  latitude: number;
  longitude: number;
  access: Access;
  accessDetails: string | null;
  hours: string | null;
  accessible: boolean | null;
  items: string[];
  rating: number | null;
  reviewCount: number;
  photoIds: string[];
  demo: boolean;
  details?: BathroomDetails;
}

export interface BathroomInput {
  name: string;
  address: string;
  complement?: string;
  category: string;
  latitude: number | null;
  longitude: number | null;
  access: Access;
  accessDetails: string;
  hours: string;
  accessible: boolean | null;
  items: string[];
  details?: BathroomDetails;
}

export interface NearbyCandidate {
  bathroom: Bathroom;
  distanceMeters: number;
  possibleDuplicate: boolean;
  differentComplement: boolean;
}

export interface NearbyResult {
  radiusMeters: number;
  candidates: NearbyCandidate[];
}

export const ACCESS_LABELS: Record<Access, string> = { FREE: 'Acesso livre', CUSTOMERS: 'Apenas clientes', PAID: 'Com taxa', OTHER: 'Outra condição' };

export const ITEM_LABELS: Record<string, string> = { PAPER: 'Papel higiênico', SOAP: 'Sabonete líquido', SINK: 'Pia', DRYER: 'Secador de mãos', BIN: 'Lixeira', CHANGING_TABLE: 'Fraldário' };
