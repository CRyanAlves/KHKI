import { Injectable, inject } from '@angular/core';
import { MapsService, TravelMode, TravelRoute } from '../../../../integrations/maps/maps.service';
import type { Location } from '../../../../domain/location/location.model';

@Injectable()
export class RoutePlanningService {
  private readonly maps = inject(MapsService);
  private readonly cache = new Map<string, TravelRoute>();

  async findRoute(origin: Location, destination: Location, mode: TravelMode, signal: AbortSignal): Promise<TravelRoute> {
    const key = JSON.stringify([origin, destination, mode]);
    const route = this.cache.get(key) || (await this.maps.directions(origin, destination, mode, signal));
    if (!signal.aborted) {
      if (this.cache.size >= 20) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key, route);
    }
    return route;
  }
}
