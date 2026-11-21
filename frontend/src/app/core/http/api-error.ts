import { HttpErrorResponse } from '@angular/common/http';

export function apiError(error: unknown): string {
  return error instanceof HttpErrorResponse ? error.error?.detail || (error.status === 0 || error.status === 502 ? 'Não foi possível conectar ao servidor. Confira se o backend está em execução.' : 'Não foi possível concluir. Tente novamente.') : error instanceof Error ? error.message : 'Não foi possível concluir. Tente novamente.';
}
