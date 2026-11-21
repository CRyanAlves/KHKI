import type { Location } from '../../../../domain/location/location.model';
import type { Feature, MultiLineString } from 'geojson';

export interface NavigationFrame {
  position: Location;
  heading: number;
  accuracy: number | null;
  following: boolean;
  remainingGeometry: Feature<MultiLineString> | null;
}
