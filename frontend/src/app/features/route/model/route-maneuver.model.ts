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
