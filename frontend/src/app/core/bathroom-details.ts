import { BathroomDetails, Access } from './models';
export const AUDIENCE_LABELS = { UNKNOWN: 'Não informado', PUBLIC: 'Livre para todos', CUSTOMERS: 'Apenas clientes', AUTHORIZATION: 'Exige autorização', OTHER: 'Outra condição' } as const;
export const CHARGE_LABELS = { UNKNOWN: 'Não informada', YES: 'Sim', NO: 'Não' } as const;
export const BATHROOM_TYPE_LABELS: Record<string, string> = { INDIVIDUAL: 'Individual / unissex', FEMALE: 'Feminino', MALE: 'Masculino' };
export const OBSERVED_ACCESSIBILITY = [
  { key: 'stepFreeAccess', label: 'Acesso sem degraus' },
  { key: 'elevator', label: 'Elevador quando necessário' },
  { key: 'adaptedCabin', label: 'Cabine adaptada informada' },
  { key: 'grabBars', label: 'Barras de apoio' }
] as const;
export function emptyBathroomDetails(access?: Access): BathroomDetails {
  return { audience: access === 'FREE' ? 'PUBLIC' : access === 'CUSTOMERS' ? 'CUSTOMERS' : access === 'OTHER' ? 'OTHER' : 'UNKNOWN', charge: access === 'PAID' ? 'YES' : 'UNKNOWN', feeAmount: null, bathroomTypes: [], stepFreeAccess: null, elevator: null, adaptedCabin: null, grabBars: null, lastVisited: null };
}
export function legacyAccess(details: BathroomDetails): Access {
  return details.audience === 'CUSTOMERS' ? 'CUSTOMERS' : details.audience === 'PUBLIC' && details.charge !== 'YES' ? 'FREE' : details.charge === 'YES' && !['AUTHORIZATION', 'OTHER'].includes(details.audience) ? 'PAID' : 'OTHER';
}
export function triStateLabel(value: boolean | null): string {
  return value === null ? 'Não informado' : value ? 'Sim' : 'Não';
}
export function bathroomDetailRows(details: BathroomDetails): { label: string; value: string }[] {
  return [
    { label: 'Quem pode usar', value: AUDIENCE_LABELS[details.audience] },
    { label: 'Há cobrança?', value: CHARGE_LABELS[details.charge] },
    { label: 'Valor aproximado', value: details.feeAmount === null ? 'Não informado' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(details.feeAmount) },
    { label: 'Tipos de banheiro', value: details.bathroomTypes.map((type) => BATHROOM_TYPE_LABELS[type]).join(', ') || 'Não informado' },
    ...OBSERVED_ACCESSIBILITY.map((item) => ({ label: item.label, value: triStateLabel(details[item.key]) })),
    { label: 'Última visita', value: details.lastVisited ? details.lastVisited.split('-').reverse().join('/') : 'Não informada' }
  ];
}
