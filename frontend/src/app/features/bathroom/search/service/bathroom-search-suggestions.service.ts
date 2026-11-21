import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { BathroomApiService } from '../../service/bathroom-api.service';
import { MapsService } from '../../../../integrations/maps/maps.service';
import type { Location } from '../../../../domain/location/location.model';
import type { BathroomSearchSuggestion } from '../model/bathroom-search-suggestion.model';

@Injectable()
export class BathroomSearchSuggestionsService {
  private readonly bathrooms = inject(BathroomApiService);
  private readonly maps = inject(MapsService);
  private timer?: ReturnType<typeof setTimeout>;
  private controller?: AbortController;
  private sequence = 0;
  readonly items = signal<BathroomSearchSuggestion[]>([]);
  readonly busy = signal(false);
  readonly error = signal('');

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancel());
  }

  search(query: string, position: Location | null): void {
    this.cancel();
    const sequence = this.sequence;
    this.items.set([]);
    this.error.set('');
    this.busy.set(false);
    if (query.trim().length < 3) return;
    this.busy.set(true);
    this.timer = setTimeout(() => void this.load(query.trim(), position, sequence), 350);
  }

  cancel(): void {
    clearTimeout(this.timer);
    this.controller?.abort();
    this.sequence++;
  }

  private async load(query: string, position: Location | null, sequence: number): Promise<void> {
    const controller = new AbortController();
    this.controller = controller;
    const [bathrooms, addresses] = await Promise.allSettled([this.bathrooms.search({ q: query }), this.maps.configured ? this.maps.autocomplete(query, controller.signal, position) : Promise.resolve([])]);
    if (sequence !== this.sequence || controller.signal.aborted) return;
    this.items.set([...(bathrooms.status === 'fulfilled' ? bathrooms.value.slice(0, 5).map((bathroom) => ({ label: bathroom.name, detail: bathroom.address, bathroom })) : []), ...(addresses.status === 'fulfilled' ? addresses.value.map((address) => ({ label: address.label, detail: address.detail, address })) : [])]);
    if (bathrooms.status === 'rejected' || addresses.status === 'rejected') this.error.set('Parte das sugestões está indisponível. Você pode tentar novamente ou buscar os locais cadastrados.');
    this.busy.set(false);
  }
}
