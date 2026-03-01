import type { ItineraryLeg, ItineraryStop, TravelMode } from "../data/types";
import { buildLegPathPoints, haversineDistanceKm } from "./interpolation";
import { seededTravelModes } from "./seed";

function getLegId(fromStopId: string, toStopId: string) {
  return `${fromStopId}__${toStopId}`;
}

export function inferTravelMode(
  fromStop: ItineraryStop,
  toStop: ItineraryStop,
  distanceKm: number | null
): TravelMode {
  if (distanceKm === null) {
    return "ground";
  }

  if (fromStop.country !== toStop.country && distanceKm > 600) {
    return "air";
  }

  if (distanceKm > 900) {
    return "air";
  }

  return "ground";
}

export function deriveLegs(
  stops: ItineraryStop[],
  previousLegs: ItineraryLeg[] = []
): ItineraryLeg[] {
  const previousModes = new Map(previousLegs.map((leg) => [leg.id, leg.mode]));

  return stops.slice(0, -1).map((fromStop, index) => {
    const toStop = stops[index + 1];
    const legId = getLegId(fromStop.id, toStop.id);
    const distanceKm =
      fromStop.lat !== null &&
      fromStop.lon !== null &&
      toStop.lat !== null &&
      toStop.lon !== null
        ? Math.round(
            haversineDistanceKm(
              fromStop.lat,
              fromStop.lon,
              toStop.lat,
              toStop.lon
            )
          )
        : null;

    const mode =
      previousModes.get(legId) ??
      seededTravelModes[index] ??
      inferTravelMode(fromStop, toStop, distanceKm);

    return {
      id: legId,
      fromStopId: fromStop.id,
      toStopId: toStop.id,
      mode,
      distanceKm,
      pathPoints: buildLegPathPoints(fromStop, toStop, mode),
    } satisfies ItineraryLeg;
  });
}
