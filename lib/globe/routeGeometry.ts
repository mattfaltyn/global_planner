export function getRouteAltitude(distanceKm: number) {
  return Math.min(0.2, Math.max(0.04, distanceKm / 42000));
}

export function getRouteStroke(distanceKm: number, active: boolean) {
  const baseStroke = Math.min(0.72, Math.max(0.14, distanceKm / 22000));
  return active ? baseStroke + 0.18 : baseStroke;
}
