import type { ItineraryLeg, ItinerarySelection, ItineraryStop } from "../data/types";

export function serializeItinerarySelectionToQuery(
  selection: ItinerarySelection
) {
  const params = new URLSearchParams();

  if (!selection) {
    return "";
  }

  if (selection.kind === "stop") {
    params.set("stop", selection.stopId);
  }

  if (selection.kind === "leg") {
    params.set("leg", selection.legId);
  }

  return `?${params.toString()}`;
}

export function parseItinerarySelectionFromQuery(
  search: string,
  stops: ItineraryStop[],
  legs: ItineraryLeg[]
): ItinerarySelection {
  const params = new URLSearchParams(search);
  const stopId = params.get("stop");
  const legId = params.get("leg");

  if (stopId && stops.some((stop) => stop.id === stopId)) {
    return { kind: "stop", stopId };
  }

  if (legId && legs.some((leg) => leg.id === legId)) {
    return { kind: "leg", legId };
  }

  return null;
}
