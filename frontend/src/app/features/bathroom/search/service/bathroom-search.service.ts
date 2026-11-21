import { Injectable, inject } from '@angular/core';
import { BathroomApiService } from '../../service/bathroom-api.service';
import type { Bathroom } from '../../../../domain/bathrooms/bathroom.model';

const SEARCH_PAGE_SIZE = 200;
const SEARCH_MAX_OFFSET = 100000;

@Injectable({ providedIn: 'root' })
export class BathroomSearchService {
  private readonly bathrooms = inject(BathroomApiService);

  async *loadResultPages(query: string): AsyncGenerator<Bathroom[]> {
    const parameters: Record<string, string> = { q: query };
    const received = new Set<string>();
    for (let offset = 0; ; offset += SEARCH_PAGE_SIZE) {
      if (offset > SEARCH_MAX_OFFSET) throw new Error('A busca está muito ampla. Informe um nome ou região para continuar.');
      const page = await this.bathrooms.search(offset ? { ...parameters, offset: String(offset) } : parameters);
      if (page.some((bathroom) => received.has(bathroom.id))) throw new Error('Não foi possível carregar a busca completa. Tente novamente.');
      page.forEach((bathroom) => received.add(bathroom.id));
      yield page;
      if (page.length < SEARCH_PAGE_SIZE) return;
    }
  }
}
