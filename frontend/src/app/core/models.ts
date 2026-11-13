export type Access = 'FREE' | 'CUSTOMERS' | 'PAID' | 'OTHER';
export type Status = 'PENDING' | 'NEEDS_INFORMATION' | 'APPROVED' | 'REJECTED' | 'HIDDEN' | 'REMOVED';
export type TargetType = 'BATHROOM' | 'REVIEW';
export interface User {
  id: string;
  name: string;
  role: 'USER' | 'ADMIN';
}
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
export interface Review {
  id: string;
  author: string;
  cleanliness: number;
  structure: number;
  comment: string | null;
  createdAt: string;
}
export interface Contribution {
  id: string;
  type: TargetType;
  title: string;
  status: Status;
  reason: string | null;
  createdAt: string;
  bathroomId: string;
}
export interface Report {
  id: string;
  targetType: TargetType;
  targetId: string;
  reason: string;
  createdAt: string;
}
export interface Location {
  lat: number;
  lng: number;
}
export interface ModerationDetail {
  contribution: Contribution;
  content: Bathroom | Review | Contribution;
  author: string;
  version: number;
  bathroom: Bathroom;
  photos: { id: string }[];
}
export interface AuditEntry {
  id: string;
  targetType: TargetType;
  targetId: string;
  moderatorId: string;
  decision: Status;
  reason: string;
  createdAt: string;
}
export const ACCESS_LABELS: Record<Access, string> = { FREE: 'Acesso livre', CUSTOMERS: 'Apenas clientes', PAID: 'Com taxa', OTHER: 'Outra condição' };
export const STATUS_LABELS: Record<Status, string> = { PENDING: 'Em análise', NEEDS_INFORMATION: 'Aguardando informações', APPROVED: 'Aprovado', REJECTED: 'Rejeitado', HIDDEN: 'Oculto', REMOVED: 'Removido' };
export const ITEM_LABELS: Record<string, string> = { PAPER: 'Papel higiênico', SOAP: 'Sabonete líquido', SINK: 'Pia', DRYER: 'Secador de mãos', BIN: 'Lixeira', CHANGING_TABLE: 'Fraldário' };
export const REPORT_LABELS: Record<string, string> = { INCORRECT: 'Informação incorreta', CLOSED: 'Local fechado', PRIVACY: 'Privacidade', INAPPROPRIATE: 'Conteúdo inadequado', SPAM: 'Spam', OTHER: 'Outro motivo' };
export const TYPE_LABELS: Record<TargetType, string> = { BATHROOM: 'Banheiro', REVIEW: 'Avaliação' };

export interface MapArea {
  north: number;
  south: number;
  east: number;
  west: number;
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
