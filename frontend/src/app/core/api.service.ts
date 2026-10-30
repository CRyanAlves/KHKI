import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    return firstValueFrom(this.http.get<T>('/api' + path, { params: new HttpParams({ fromObject: params }) }));
  }
  post<T>(path: string, body: unknown): Promise<T> {
    return firstValueFrom(this.http.post<T>('/api' + path, body));
  }
  put<T>(path: string, body: unknown): Promise<T> {
    return firstValueFrom(this.http.put<T>('/api' + path, body));
  }
  error(error: unknown): string {
    return error instanceof HttpErrorResponse ? error.error?.detail || (error.status === 0 || error.status === 502 ? 'Não foi possível conectar ao servidor. Confira se o backend está em execução.' : 'Não foi possível concluir. Tente novamente.') : error instanceof Error ? error.message : 'Não foi possível concluir. Tente novamente.';
  }
}
