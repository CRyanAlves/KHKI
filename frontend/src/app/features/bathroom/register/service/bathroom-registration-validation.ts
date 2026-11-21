import type { BathroomInput } from '../../../../domain/bathrooms/bathroom.model';
import type { Location } from '../../../../domain/location/location.model';
import { validPoint } from '../../../../shared/geo/navigation-geometry';

export function registrationLocationErrors(form: BathroomInput, point: Location | null, addressChanged: boolean): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.name.trim()) errors['name'] = 'Informe o nome do local.';
  if (!form.category.trim()) errors['category'] = 'Selecione a categoria do local.';
  if (!form.address.trim()) errors['address'] = 'Informe o endereço do banheiro.';
  if (!point || form.latitude === null || form.longitude === null || !validPoint({ lat: form.latitude, lng: form.longitude })) errors['location'] = 'Busque um endereço ou escolha um ponto válido no mapa.';
  else if (addressChanged) errors['location'] = 'O endereço mudou. Busque novamente ou confirme que este ponto corresponde ao endereço informado.';
  return errors;
}

export function registrationFeeError(amount: number | null): string {
  return amount !== null && (!Number.isFinite(amount) || amount <= 0 || amount > 999999.99 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001) ? 'Informe um valor positivo com até duas casas decimais, ou deixe em branco.' : '';
}

export function registrationVisitDateError(value: string | null, today: string): string {
  return value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value > today) ? 'Informe uma data válida que não esteja no futuro.' : '';
}
