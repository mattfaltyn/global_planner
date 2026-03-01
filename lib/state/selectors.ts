import type {
  ItineraryLeg,
  ItinerarySelection,
  ItineraryStop,
  PlaybackState,
} from "../data/types";
import {
  parseItinerarySelectionFromQuery,
  serializeItinerarySelectionToQuery,
} from "../itinerary/urls";

export {
  parseItinerarySelectionFromQuery,
  serializeItinerarySelectionToQuery,
};

export function getSelectedStop(
  selection: ItinerarySelection,
  stops: ItineraryStop[]
) {
  if (!selection || selection.kind !== "stop") {
    return null;
  }

  return stops.find((stop) => stop.id === selection.stopId) ?? null;
}

export function getSelectedLeg(
  selection: ItinerarySelection,
  legs: ItineraryLeg[]
) {
  if (!selection || selection.kind !== "leg") {
    return null;
  }

  return legs.find((leg) => leg.id === selection.legId) ?? null;
}

export function getLegByIndex(legs: ItineraryLeg[], activeLegIndex: number) {
  return legs[activeLegIndex] ?? null;
}

export function getTravelModeCounts(legs: ItineraryLeg[]) {
  return legs.reduce(
    (counts, leg) => {
      counts[leg.mode] += 1;
      return counts;
    },
    { air: 0, ground: 0 }
  );
}

export function getTripDateSpan(stops: ItineraryStop[]) {
  const departureDates = stops
    .map((stop) => stop.departureDate)
    .filter((value): value is string => Boolean(value));

  if (departureDates.length === 0) {
    return null;
  }

  return {
    start: departureDates[0],
    end: departureDates[departureDates.length - 1],
  };
}

export function getPlaybackProgressPercent(playback: PlaybackState) {
  return Math.round(playback.progress * 100);
}
