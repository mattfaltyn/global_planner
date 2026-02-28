export function getRouteAltitude(distanceKm: number) {
  return Math.min(0.35, Math.max(0.08, distanceKm / 25000));
}

export function getRouteStroke(distanceKm: number, active: boolean) {
  const baseStroke = Math.min(1.2, Math.max(0.35, distanceKm / 10000));
  return active ? baseStroke + 0.35 : baseStroke;
}
