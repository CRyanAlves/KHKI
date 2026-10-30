import { distanceMeters } from './navigation-geometry';

export interface RouteManeuver {
  text: string;
  type: string;
  icon: string;
  fromMeters: number | null;
}
export interface DirectionPreview extends RouteManeuver {
  index: number;
  distanceMeters: number | null;
}
const PASSED_MANEUVER_METERS = 8;
const ICONS: Readonly<Record<string, string>> = {
  StartAt: 'ArrowUp',
  StartAtRight: 'ArrowUp',
  StartAtLeft: 'ArrowUp',
  Straight: 'ArrowUp',
  SlightRight: 'ArrowUpRight',
  Right: 'CornerUpRight',
  SharpRight: 'CornerDownRight',
  TurnAroundRight: 'Redo2',
  SlightLeft: 'ArrowUpLeft',
  Left: 'CornerUpLeft',
  SharpLeft: 'CornerDownLeft',
  TurnAroundLeft: 'Undo2',
  ExitRight: 'ArrowUpRight',
  ExitLeft: 'ArrowUpLeft',
  StayRight: 'ArrowUpRight',
  StayLeft: 'ArrowUpLeft',
  Merge: 'Merge',
  MergeRight: 'Merge',
  MergeLeft: 'Merge',
  Roundabout: 'RotateCw',
  DestinationReached: 'Flag',
  DestinationReachedRight: 'Flag',
  DestinationReachedLeft: 'Flag',
  FerryEnter: 'Ship',
  FerryExit: 'Ship'
};
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
export function parseManeuvers(legs: unknown, coordinates: number[][][]): RouteManeuver[] {
  const positions: number[][] = [];
  let offset = 0;
  for (const line of coordinates) {
    const distances = [offset];
    for (let index = 1; index < line.length; index++) {
      const length = distanceMeters({ lat: line[index - 1][1], lng: line[index - 1][0] }, { lat: line[index][1], lng: line[index][0] });
      offset += length < 0.01 ? 0 : length;
      distances.push(offset);
    }
    positions.push(distances);
  }
  const result: RouteManeuver[] = [];
  for (const [legIndex, leg] of (Array.isArray(legs) ? legs.slice(0, 500) : []).entries()) {
    const steps = record(leg)['steps'];
    if (!Array.isArray(steps)) continue;
    let previous = -1;
    for (const raw of steps.slice(0, 500)) {
      if (result.length >= 500) return result;
      const step = record(raw);
      const instruction = record(step['instruction']);
      const text = instruction['text'];
      if (typeof text !== 'string' || !text.trim() || text.length > 2000) continue;
      const type = typeof instruction['type'] === 'string' && Object.hasOwn(ICONS, instruction['type']) ? instruction['type'] : 'None';
      const from = step['from_index'];
      const to = step['to_index'];
      const line = positions[legIndex];
      const valid = typeof from === 'number' && Number.isSafeInteger(from) && from >= 0 && from >= previous && !!line && from < line.length && typeof to === 'number' && Number.isSafeInteger(to) && to >= from && to < line.length;
      if (valid) previous = from as number;
      result.push({ text, type, icon: Object.hasOwn(ICONS, type) ? ICONS[type] : 'Navigation', fromMeters: valid ? line[from as number] : null });
    }
  }
  return result;
}
export function upcomingDirections(maneuvers: RouteManeuver[], traveled: number, arrived = false): DirectionPreview[] {
  if (arrived) return [{ text: 'Você chegou às proximidades do destino.', type: 'DestinationReached', icon: 'Flag', fromMeters: null, distanceMeters: null, index: -1 }];
  const progress = Number.isFinite(traveled) ? Math.max(0, traveled) : 0;
  const positioned = maneuvers.every((maneuver) => maneuver.fromMeters !== null);
  let index = 0;
  if (positioned) while (index < maneuvers.length - 1 && maneuvers[index].fromMeters! + PASSED_MANEUVER_METERS < progress) index++;
  return maneuvers.slice(index, index + 2).map((maneuver, next) => ({ ...maneuver, index: index + next, distanceMeters: positioned ? Math.max(0, maneuver.fromMeters! - progress) : null }));
}
export function formatRouteDuration(milliseconds: number | undefined): string {
  if (typeof milliseconds !== 'number' || !Number.isFinite(milliseconds) || milliseconds < 0) return 'Tempo não informado';
  const minutes = Math.max(1, Math.round(milliseconds / 60000));
  if (minutes < 60) return minutes + ' min';
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return hours + ' h' + (remaining ? ' ' + remaining + ' min' : '');
}
