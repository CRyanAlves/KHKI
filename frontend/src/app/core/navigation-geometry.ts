import type { Location } from './models';
import type { TravelRoute } from './maps.service';
import type { Feature, MultiLineString } from 'geojson';

const EARTH_RADIUS_METERS = 6371000;
const RADIANS = Math.PI / 180;
export interface TrackEdge {
  start: Location;
  end: Location;
  from: number;
  to: number;
  heading: number;
  line: number;
  index: number;
}
export interface RouteTrack {
  edges: TrackEdge[];
  length: number;
  coordinates: number[][][];
}
export function validPoint(point: Location): boolean {
  return Number.isFinite(point.lat) && Math.abs(point.lat) <= 90 && Number.isFinite(point.lng) && Math.abs(point.lng) <= 180;
}
export function normalizeHeading(value: number): number {
  return ((value % 360) + 360) % 360;
}
export function headingDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}
export function distanceMeters(start: Location, end: Location): number {
  const latitude = (end.lat - start.lat) * RADIANS;
  const longitude = (end.lng - start.lng) * RADIANS;
  const value = Math.sin(latitude / 2) ** 2 + Math.cos(start.lat * RADIANS) * Math.cos(end.lat * RADIANS) * Math.sin(longitude / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(Math.max(0, value)), Math.sqrt(Math.max(0, 1 - value)));
}
export function bearing(start: Location, end: Location): number {
  const longitude = (end.lng - start.lng) * RADIANS;
  const y = Math.sin(longitude) * Math.cos(end.lat * RADIANS);
  const x = Math.cos(start.lat * RADIANS) * Math.sin(end.lat * RADIANS) - Math.sin(start.lat * RADIANS) * Math.cos(end.lat * RADIANS) * Math.cos(longitude);
  return normalizeHeading(Math.atan2(y, x) / RADIANS);
}
export function buildTrack(route: TravelRoute): RouteTrack {
  if (route?.geometry?.geometry?.type !== 'MultiLineString' || !Array.isArray(route.geometry.geometry.coordinates)) throw new Error('O trajeto não contém uma geometria válida.');
  const track: RouteTrack = { edges: [], length: 0, coordinates: route.geometry.geometry.coordinates };
  let count = 0;
  for (const [lineIndex, line] of route.geometry.geometry.coordinates.entries()) {
    if (!Array.isArray(line) || line.length < 2) throw new Error('O trajeto contém um segmento inválido.');
    for (let index = 1; index < line.length; index++) {
      if (++count > 100000) throw new Error('O trajeto excede o limite permitido para navegação.');
      const start = { lat: line[index - 1][1], lng: line[index - 1][0] };
      const end = { lat: line[index][1], lng: line[index][0] };
      if (!validPoint(start) || !validPoint(end)) throw new Error('O trajeto contém coordenadas inválidas.');
      const length = distanceMeters(start, end);
      if (length < 0.01) continue;
      track.edges.push({ start, end, from: track.length, to: track.length + length, heading: bearing(start, end), line: lineIndex, index });
      track.length += length;
    }
  }
  if (!track.edges.length) throw new Error('O trajeto não contém um percurso válido para navegação.');
  return track;
}
export function sampleTrack(track: RouteTrack, distance: number): { point: Location; heading: number } {
  const traveled = Math.max(0, Math.min(track.length, Number.isFinite(distance) ? distance : 0));
  const edge = track.edges[trackEdgeIndex(track, traveled)];
  const fraction = (traveled - edge.from) / (edge.to - edge.from);
  return { point: { lat: edge.start.lat + (edge.end.lat - edge.start.lat) * fraction, lng: edge.start.lng + (edge.end.lng - edge.start.lng) * fraction }, heading: edge.heading };
}
function trackEdgeIndex(track: RouteTrack, traveled: number): number {
  let left = 0;
  let right = track.edges.length - 1;
  while (left < right) {
    const middle = Math.floor((left + right) / 2);
    if (track.edges[middle].to < traveled) left = middle + 1;
    else right = middle;
  }
  return left;
}
export function remainingTrack(track: RouteTrack, distance: number): Feature<MultiLineString> {
  const traveled = Math.max(0, Math.min(track.length, Number.isFinite(distance) ? distance : 0));
  if (traveled >= track.length) return { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: [] } };
  const edge = track.edges[trackEdgeIndex(track, traveled)];
  const point = sampleTrack(track, traveled).point;
  const first = [[point.lng, point.lat], ...track.coordinates[edge.line].slice(edge.index)];
  return { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: [first, ...track.coordinates.slice(edge.line + 1)] } };
}
export function nearestProgress(track: RouteTrack, point: Location): { traveled: number; distance: number } {
  let closest = Infinity;
  let traveled = 0;
  const scale = Math.max(0.000001, Math.cos(point.lat * RADIANS));
  for (const edge of track.edges) {
    const x = (edge.end.lng - edge.start.lng) * scale;
    const y = edge.end.lat - edge.start.lat;
    const denominator = x * x + y * y;
    const fraction = denominator ? Math.max(0, Math.min(1, ((point.lng - edge.start.lng) * scale * x + (point.lat - edge.start.lat) * y) / denominator)) : 0;
    const projected = { lat: edge.start.lat + fraction * (edge.end.lat - edge.start.lat), lng: edge.start.lng + fraction * (edge.end.lng - edge.start.lng) };
    const distance = distanceMeters(point, projected);
    if (distance < closest) {
      closest = distance;
      traveled = edge.from + fraction * (edge.to - edge.from);
    }
  }
  return { traveled, distance: closest };
}
export function compassHeading(event: DeviceOrientationEvent, screenAngle = 0): number | null {
  if (!Number.isFinite(screenAngle) || (event.beta !== null && event.beta !== undefined && !Number.isFinite(event.beta)) || (event.gamma !== null && event.gamma !== undefined && !Number.isFinite(event.gamma))) return null;
  const compass = event as DeviceOrientationEvent & { webkitCompassHeading?: number; webkitCompassAccuracy?: number };
  if (typeof compass.webkitCompassHeading === 'number' && Number.isFinite(compass.webkitCompassHeading) && (compass.webkitCompassAccuracy === undefined || (compass.webkitCompassAccuracy >= 0 && compass.webkitCompassAccuracy <= 50))) return normalizeHeading(compass.webkitCompassHeading + screenAngle);
  if (!event.absolute || event.alpha === null || !Number.isFinite(event.alpha)) return null;
  const alpha = event.alpha * RADIANS;
  const beta = (event.beta ?? 90) * RADIANS;
  const gamma = (event.gamma ?? 0) * RADIANS;
  const x = -Math.cos(alpha) * Math.sin(gamma) - Math.sin(alpha) * Math.sin(beta) * Math.cos(gamma);
  const y = -Math.sin(alpha) * Math.sin(gamma) + Math.cos(alpha) * Math.sin(beta) * Math.cos(gamma);
  return normalizeHeading((Math.hypot(x, y) < 0.000001 ? -alpha : Math.atan2(x, y)) / RADIANS + screenAngle);
}
