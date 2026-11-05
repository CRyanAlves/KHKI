import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, Subject, firstValueFrom, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly expired = new Subject<void>();
  readonly authenticationExpired = this.expired.asObservable();
  private request<T>(request: Observable<T>, path: string): Promise<T> {
    return firstValueFrom(
      request.pipe(
        tap({
          error: (error: unknown) => {
            if (error instanceof HttpErrorResponse && error.status === 401 && !path.startsWith('/auth/')) this.expired.next();
          }
        })
      )
    );
  }
  get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    return this.request(this.http.get<T>('/api' + path, { params: new HttpParams({ fromObject: params }) }), path);
  }
  post<T>(path: string, body: unknown): Promise<T> {
    return this.request(this.http.post<T>('/api' + path, body), path);
  }
  put<T>(path: string, body: unknown): Promise<T> {
    return this.request(this.http.put<T>('/api' + path, body), path);
  }
  error(error: unknown): string {
    return error instanceof HttpErrorResponse ? error.error?.detail || (error.status === 0 || error.status === 502 ? 'Não foi possível conectar ao servidor. Confira se o backend está em execução.' : 'Não foi possível concluir. Tente novamente.') : error instanceof Error ? error.message : 'Não foi possível concluir. Tente novamente.';
  }
}
