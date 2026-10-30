import { Injectable } from '@angular/core';
import { Theme } from './theme.service';
import { Location } from './models';
import { validPoint } from './navigation-geometry';
import type { Feature, MultiLineString } from 'geojson';
import { isTravelMode, TravelMode } from './travel-modes';
import { parseManeuvers, RouteManeuver } from './route-guidance';
export type { TravelMode } from './travel-modes';

declare global {
  interface Window {
    KHKI_CONFIG?: { geoapifyApiKey: string; geoapifyApiBaseUrl?: string; geoapifyMapsBaseUrl?: string; devRouteSimulation?: boolean };
  }
}
export interface AddressSuggestion {
  label: string;
  detail: string;
  position: Location;
}
export interface TravelRoute {
  geometry: Feature<MultiLineString>;
  distanceMeters?: number;
  durationMillis?: number;
  instructions: string[];
  maneuvers?: RouteManeuver[];
}
export type WalkingRoute = TravelRoute;
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
function nonnegative(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

@Injectable({ providedIn: 'root' })
export class MapsService {
  private readonly key = window.KHKI_CONFIG?.geoapifyApiKey?.trim() || '';
  readonly configured = !!this.key;
  private endpoint(base: string | undefined, fallback: string, path: string, parameters: Record<string, string> = {}): URL {
    if (!this.configured) throw new Error('Configure a chave gratuita da Geoapify para carregar o mapa e calcular rotas.');
    const url = new URL((base || fallback).replace(/\/$/, '') + path);
    const local = ['127.0.0.1', 'localhost'].includes(url.hostname) && url.protocol === 'http:';
    if (url.protocol !== 'https:' && !local) throw new Error('A configuração de mapas deve usar HTTPS.');
    url.search = new URLSearchParams({ ...parameters, apiKey: this.key }).toString();
    return url;
  }
  styleUrl(theme: Theme = 'light'): string {
    const style = theme === 'dark' ? 'dark-matter' : 'positron';
    return this.endpoint(window.KHKI_CONFIG?.geoapifyMapsBaseUrl, 'https://maps.geoapify.com/v1', '/styles/' + style + '/style.json').toString();
  }
  private async request(path: string, parameters: Record<string, string>, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const url = this.endpoint(window.KHKI_CONFIG?.geoapifyApiBaseUrl, 'https://api.geoapify.com/v1', path, parameters);
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) controller.abort();
    const timer = window.setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, { signal: controller.signal, credentials: 'omit' });
      if (!response.ok) {
        if ([401, 403].includes(response.status)) throw new Error('A chave da Geoapify foi recusada. Confira a chave e as restrições de domínio.');
        if (response.status === 429) throw new Error('O limite de uso da Geoapify foi atingido. Aguarde e tente novamente.');
        throw new Error('O serviço de mapas está indisponível. Tente novamente em instantes.');
      }
      const body = await response.text();
      if (body.length > 2000000) throw new Error('A resposta do serviço de mapas excedeu o limite permitido.');
      try {
        return record(JSON.parse(body));
      } catch {
        throw new Error('O serviço de mapas retornou uma resposta inválida.');
      }
    } catch (error) {
      if (signal?.aborted) throw new Error('A consulta de mapas foi cancelada.');
      if (controller.signal.aborted) throw new Error('O serviço de mapas demorou para responder. Tente novamente.');
      if (error instanceof TypeError) throw new Error('Não foi possível conectar ao serviço de mapas. Confira sua conexão.');
      throw error;
    } finally {
      window.clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }
  private coordinate(value: unknown): [number, number] {
    if (!Array.isArray(value) || value.length < 2 || typeof value[0] !== 'number' || typeof value[1] !== 'number' || !validPoint({ lat: value[1], lng: value[0] })) throw new Error('O serviço de mapas retornou coordenadas inválidas.');
    return [value[0], value[1]];
  }
  async geocode(address: string, signal?: AbortSignal): Promise<Location> {
    const text = address.trim();
    if (!text || text.length > 300) throw new Error('Informe um endereço com até 300 caracteres.');
    const response = await this.request('/geocode/search', { text, format: 'json', limit: '1', lang: 'pt', filter: 'countrycode:br' }, signal);
    if (!Array.isArray(response['results'])) throw new Error('O serviço de mapas retornou uma resposta inválida.');
    const result = record(response['results'][0]);
    if (!Object.keys(result).length) throw new Error('Endereço não encontrado. Tente informar cidade e número.');
    const [lng, lat] = this.coordinate([result['lon'], result['lat']]);
    return { lat, lng };
  }
  async autocomplete(address: string, signal?: AbortSignal, bias?: Location | null): Promise<AddressSuggestion[]> {
    const text = address.trim();
    if (text.length < 3 || text.length > 300) throw new Error('Digite entre 3 e 300 caracteres para buscar um endereço.');
    const parameters: Record<string, string> = { text, format: 'json', limit: '5', lang: 'pt', filter: 'countrycode:br' };
    if (bias && validPoint(bias)) parameters['bias'] = `proximity:${bias.lng},${bias.lat}`;
    const response = await this.request('/geocode/autocomplete', parameters, signal);
    if (!Array.isArray(response['results'])) throw new Error('O serviço de endereços retornou uma resposta inválida.');
    return response['results'].slice(0, 5).map((value) => {
      const result = record(value);
      const [lng, lat] = this.coordinate([result['lon'], result['lat']]);
      if (typeof result['formatted'] !== 'string' || !result['formatted'].trim() || result['formatted'].length > 500) throw new Error('O serviço de endereços retornou uma resposta inválida.');
      return { label: result['formatted'], detail: typeof result['address_line2'] === 'string' ? result['address_line2'].slice(0, 300) : '', position: { lat, lng } };
    });
  }
  walking(origin: string | Location, destination: Location): Promise<WalkingRoute> {
    return this.directions(origin, destination, 'walk');
  }
  async directions(origin: string | Location, destination: Location, mode: TravelMode = 'drive', signal?: AbortSignal): Promise<TravelRoute> {
    if (!isTravelMode(mode)) throw new Error('Selecione um modo de transporte válido.');
    const start = typeof origin === 'string' ? await this.geocode(origin, signal) : origin;
    if (!validPoint(start) || !validPoint(destination)) throw new Error('Informe uma origem e um destino com coordenadas válidas.');
    const response = await this.request('/routing', { waypoints: `${start.lat},${start.lng}|${destination.lat},${destination.lng}`, mode, format: 'geojson', units: 'metric', lang: 'pt-BR', details: 'instruction_details' }, signal);
    if (!Array.isArray(response['features'])) throw new Error('O serviço de mapas retornou uma resposta inválida.');
    const feature = record(response['features'][0]);
    if (!Object.keys(feature).length) throw new Error('Nenhuma rota disponível para esse trajeto com o transporte selecionado.');
    const geometry = record(feature['geometry']),
      properties = record(feature['properties']);
    const segments = geometry['type'] === 'LineString' ? [geometry['coordinates']] : geometry['type'] === 'MultiLineString' ? list(geometry['coordinates']) : [];
    let count = 0;
    const coordinates = segments.map((segment) =>
      list(segment).map((point) => {
        if (++count > 100000) throw new Error('O trajeto retornado excedeu o limite permitido.');
        return this.coordinate(point);
      })
    );
    if (!coordinates.length || coordinates.some((segment) => segment.length < 2)) throw new Error('O serviço de mapas retornou um trajeto inválido.');
    const maneuvers = parseManeuvers(properties['legs'], coordinates);
    const instructions = maneuvers.map((maneuver) => maneuver.text);
    const seconds = nonnegative(properties['time']);
    return { geometry: { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates } }, distanceMeters: nonnegative(properties['distance']), durationMillis: seconds === undefined ? undefined : nonnegative(seconds * 1000), instructions, maneuvers };
  }
  async locationIfGranted(): Promise<Location | null> {
    if (!navigator.permissions?.query || !navigator.geolocation) return null;
    let permission: PermissionStatus;
    try {
      permission = await navigator.permissions.query({ name: 'geolocation' });
    } catch {
      return null;
    }
    return permission.state === 'granted' ? this.location() : null;
  }
  location(): Promise<Location> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Seu navegador não oferece localização. Informe uma origem.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const point = { lat: position.coords.latitude, lng: position.coords.longitude };
          if (validPoint(point)) resolve(point);
          else reject(new Error('Não foi possível obter uma localização válida. Você pode informar um endereço de origem.'));
        },
        () => reject(new Error('Não foi possível acessar sua localização. Você pode informar um endereço de origem.')),
        { timeout: 10000, maximumAge: 60000 }
      );
    });
  }
}
