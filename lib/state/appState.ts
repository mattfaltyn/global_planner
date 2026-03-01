import type {
  DockMode,
  HoverState,
  ItineraryLeg,
  ItinerarySelection,
  ItineraryStop,
  LoadedDataset,
  PlaybackSpeed,
  PlaybackState,
  SearchIntent,
  TravelMode,
} from "../data/types";
import { deriveLegs } from "../itinerary/deriveLegs";
import {
  advancePlaybackState,
  createInitialPlaybackState,
  jumpPlaybackToLegEnd,
  jumpPlaybackToLegStart,
  syncPlaybackState,
} from "../itinerary/playback";
import { buildTimelineSegments } from "../itinerary/timeline";
import { buildStopFromAirport, getDayCount } from "../itinerary/resolveStops";
import { getTimelineNavigationProgress } from "./selectors";

export type LoadState =
  | { status: "idle" | "loading" }
  | { status: "ready"; dataset: LoadedDataset }
  | { status: "error"; message: string };

export type AppState = {
  loadState: LoadState;
  hover: HoverState;
  selection: ItinerarySelection;
  hasHydratedUrl: boolean;
  searchQuery: string;
  isTouchDevice: boolean;
  searchIntent: SearchIntent;
  dockMode: DockMode;
  dockCollapsed: boolean;
  itinerary: {
    stops: ItineraryStop[];
    legs: ItineraryLeg[];
    selectedInsertIndex: number | null;
    nextStopOrdinal: number;
  };
  playback: PlaybackState;
};

export type AppAction =
  | { type: "dataset/loading" }
  | { type: "dataset/loaded"; dataset: LoadedDataset }
  | { type: "dataset/error"; message: string }
  | { type: "hover/stop"; stopId: string; x: number; y: number }
  | { type: "hover/leg"; legId: string; x: number; y: number }
  | { type: "hover/clear" }
  | { type: "selection/hydrate"; selection: ItinerarySelection }
  | { type: "selection/clear" }
  | { type: "dock/set-mode"; mode: DockMode }
  | { type: "dock/toggle-collapsed" }
  | { type: "itinerary/seed"; stops: ItineraryStop[] }
  | { type: "itinerary/select-stop"; stopId: string }
  | { type: "itinerary/select-leg"; legId: string }
  | { type: "itinerary/add-stop"; airport: LoadedDataset["airports"][number] }
  | { type: "itinerary/update-stop"; stopId: string; patch: Partial<ItineraryStop> }
  | { type: "itinerary/remove-stop"; stopId: string }
  | { type: "itinerary/move-stop-up"; stopId: string }
  | { type: "itinerary/move-stop-down"; stopId: string }
  | { type: "itinerary/set-leg-mode"; legId: string; mode: TravelMode }
  | { type: "itinerary/set-insert-index"; index: number | null }
  | { type: "itinerary/replace-anchor"; stopId: string }
  | { type: "search/query"; value: string }
  | { type: "device/touch"; value: boolean }
  | { type: "playback/play"; legIndex?: number }
  | { type: "playback/pause" }
  | { type: "playback/reset" }
  | { type: "playback/set-speed"; speed: PlaybackSpeed }
  | { type: "playback/set-trip-progress"; progress: number }
  | { type: "playback/set-progress"; progress: number }
  | { type: "playback/jump-to-leg-start"; legId: string }
  | { type: "playback/jump-to-stop"; stopId: string }
  | { type: "playback/recompute-frame" }
  | { type: "playback/step-next" }
  | { type: "playback/step-prev" }
  | { type: "playback/advance-frame"; deltaMs: number };

export const initialAppState: AppState = {
  loadState: { status: "idle" },
  hover: null,
  selection: null,
  hasHydratedUrl: false,
  searchQuery: "",
  isTouchDevice: false,
  searchIntent: { kind: "add" },
  dockMode: "playback",
  dockCollapsed: false,
  itinerary: {
    stops: [],
    legs: [],
    selectedInsertIndex: null,
    nextStopOrdinal: 1,
  },
  playback: createInitialPlaybackState(),
};

function getStopIndex(stops: ItineraryStop[], stopId: string) {
  return stops.findIndex((stop) => stop.id === stopId);
}

function normalizeStopsForDates(stops: ItineraryStop[]) {
  return stops.map((stop) => ({
    ...stop,
    dayCount: getDayCount(stop.arrivalDate, stop.departureDate),
  }));
}

function setLegMode(legs: ItineraryLeg[], legId: string, mode: TravelMode) {
  return legs.map((leg) => (leg.id === legId ? { ...leg, mode } : leg));
}

function rebuildLegs(stops: ItineraryStop[], existingLegs: ItineraryLeg[]) {
  return deriveLegs(stops, existingLegs);
}

function syncPlaybackForLegs(
  playback: PlaybackState,
  stops: ItineraryStop[],
  legs: ItineraryLeg[]
) {
  if (legs.length === 0) {
    return createInitialPlaybackState();
  }

  return syncPlaybackState(playback, legs, stops);
}

function getStopProgress(
  playback: PlaybackState,
  stops: ItineraryStop[],
  legs: ItineraryLeg[],
  stopId: string
) {
  const destinationLegIndex = legs.findIndex((leg) => leg.toStopId === stopId);
  if (destinationLegIndex >= 0) {
    return jumpPlaybackToLegEnd(playback, legs, stops, destinationLegIndex).tripProgress;
  }

  const originLegIndex = legs.findIndex((leg) => leg.fromStopId === stopId);
  if (originLegIndex >= 0) {
    return jumpPlaybackToLegStart(playback, legs, stops, originLegIndex).tripProgress;
  }

  return 0;
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "dataset/loading":
      return { ...state, loadState: { status: "loading" } };
    case "dataset/loaded":
      return { ...state, loadState: { status: "ready", dataset: action.dataset } };
    case "dataset/error":
      return { ...state, loadState: { status: "error", message: action.message } };
    case "hover/stop":
      return {
        ...state,
        hover: { kind: "stop", stopId: action.stopId, x: action.x, y: action.y },
      };
    case "hover/leg":
      return {
        ...state,
        hover: { kind: "leg", legId: action.legId, x: action.x, y: action.y },
      };
    case "hover/clear":
      return { ...state, hover: null };
    case "selection/hydrate":
      return { ...state, selection: action.selection, hasHydratedUrl: true };
    case "selection/clear":
      return { ...state, selection: null, hasHydratedUrl: true };
    case "dock/set-mode":
      return { ...state, dockMode: action.mode, dockCollapsed: false };
    case "dock/toggle-collapsed":
      return { ...state, dockCollapsed: !state.dockCollapsed };
    case "itinerary/seed": {
      const legs = rebuildLegs(action.stops, []);
      return {
        ...state,
        itinerary: {
          ...state.itinerary,
          stops: action.stops,
          legs,
          nextStopOrdinal: action.stops.length + 1,
        },
        playback: syncPlaybackForLegs(state.playback, action.stops, legs),
      };
    }
    case "itinerary/select-stop":
      return {
        ...state,
        selection: { kind: "stop", stopId: action.stopId },
        hasHydratedUrl: true,
        dockMode: "edit",
        dockCollapsed: false,
        itinerary: {
          ...state.itinerary,
          selectedInsertIndex: getStopIndex(state.itinerary.stops, action.stopId),
        },
        playback: {
          ...state.playback,
          status:
            state.playback.status === "playing" ? "paused" : state.playback.status,
        },
      };
    case "itinerary/select-leg": {
      const playback = jumpPlaybackToLegStart(
        state.playback,
        state.itinerary.legs,
        state.itinerary.stops,
        Math.max(
          0,
          state.itinerary.legs.findIndex((leg) => leg.id === action.legId)
        )
      );

      return {
        ...state,
        selection: { kind: "leg", legId: action.legId },
        hasHydratedUrl: true,
        dockMode: "edit",
        dockCollapsed: false,
        playback,
      };
    }
    case "itinerary/add-stop": {
      if (state.searchIntent.kind === "replace-anchor") {
        const { stopId } = state.searchIntent;
        const stops = normalizeStopsForDates(
          state.itinerary.stops.map((stop) =>
            stop.id === stopId
              ? {
                  ...stop,
                  label: action.airport.city,
                  city: action.airport.city,
                  country: action.airport.country,
                  anchorAirportId: action.airport.id,
                  lat: action.airport.lat,
                  lon: action.airport.lon,
                  unresolved: false,
                }
              : stop
          )
        );
        const legs = rebuildLegs(stops, state.itinerary.legs);

        return {
          ...state,
          searchQuery: "",
          searchIntent: { kind: "add" },
          itinerary: {
            ...state.itinerary,
            stops,
            legs,
          },
          selection: { kind: "stop", stopId },
          playback: syncPlaybackForLegs(state.playback, stops, legs),
        };
      }

      const newStop = buildStopFromAirport(
        action.airport,
        state.itinerary.nextStopOrdinal
      );
      const insertAfterIndex =
        state.itinerary.selectedInsertIndex ??
        (state.selection?.kind === "stop"
          ? getStopIndex(state.itinerary.stops, state.selection.stopId)
          : state.itinerary.stops.length - 1);
      const stops = [...state.itinerary.stops];
      const insertAt = Math.min(stops.length, insertAfterIndex + 1);
      stops.splice(insertAt, 0, newStop);
      const normalizedStops = normalizeStopsForDates(stops);
      const legs = rebuildLegs(normalizedStops, state.itinerary.legs);

      return {
        ...state,
        searchQuery: "",
        itinerary: {
          ...state.itinerary,
          stops: normalizedStops,
          legs,
          selectedInsertIndex: insertAt,
          nextStopOrdinal: state.itinerary.nextStopOrdinal + 1,
        },
        selection: { kind: "stop", stopId: newStop.id },
        dockMode: "edit",
        dockCollapsed: false,
        playback: syncPlaybackForLegs(state.playback, normalizedStops, legs),
      };
    }
    case "itinerary/update-stop": {
      const stops = normalizeStopsForDates(
        state.itinerary.stops.map((stop) =>
          stop.id === action.stopId ? { ...stop, ...action.patch } : stop
        )
      );
      const legs = rebuildLegs(stops, state.itinerary.legs);

      return {
        ...state,
        itinerary: { ...state.itinerary, stops, legs },
        playback: syncPlaybackForLegs(state.playback, stops, legs),
      };
    }
    case "itinerary/remove-stop": {
      const stops = state.itinerary.stops.filter((stop) => stop.id !== action.stopId);
      const legs = rebuildLegs(stops, state.itinerary.legs);
      const selectedLegId =
        state.selection?.kind === "leg" ? state.selection.legId : null;
      const nextSelection =
        state.selection?.kind === "stop" && state.selection.stopId === action.stopId
          ? null
          : selectedLegId && !legs.some((leg) => leg.id === selectedLegId)
            ? null
            : state.selection;

      return {
        ...state,
        selection: nextSelection,
        itinerary: {
          ...state.itinerary,
          stops,
          legs,
          selectedInsertIndex: null,
        },
        playback: syncPlaybackForLegs(state.playback, stops, legs),
      };
    }
    case "itinerary/move-stop-up": {
      const index = getStopIndex(state.itinerary.stops, action.stopId);
      if (index <= 0) {
        return state;
      }

      const stops = [...state.itinerary.stops];
      [stops[index - 1], stops[index]] = [stops[index], stops[index - 1]];
      const legs = rebuildLegs(stops, state.itinerary.legs);

      return {
        ...state,
        itinerary: {
          ...state.itinerary,
          stops,
          legs,
          selectedInsertIndex: index - 1,
        },
        playback: syncPlaybackForLegs(state.playback, stops, legs),
      };
    }
    case "itinerary/move-stop-down": {
      const index = getStopIndex(state.itinerary.stops, action.stopId);
      if (index < 0 || index >= state.itinerary.stops.length - 1) {
        return state;
      }

      const stops = [...state.itinerary.stops];
      [stops[index], stops[index + 1]] = [stops[index + 1], stops[index]];
      const legs = rebuildLegs(stops, state.itinerary.legs);

      return {
        ...state,
        itinerary: {
          ...state.itinerary,
          stops,
          legs,
          selectedInsertIndex: index + 1,
        },
        playback: syncPlaybackForLegs(state.playback, state.itinerary.stops, legs),
      };
    }
    case "itinerary/set-leg-mode": {
      const legs = rebuildLegs(
        state.itinerary.stops,
        setLegMode(state.itinerary.legs, action.legId, action.mode)
      );

      return {
        ...state,
        itinerary: { ...state.itinerary, legs },
        playback: syncPlaybackForLegs(state.playback, state.itinerary.stops, legs),
      };
    }
    case "itinerary/set-insert-index":
      return {
        ...state,
        itinerary: { ...state.itinerary, selectedInsertIndex: action.index },
      };
    case "itinerary/replace-anchor":
      return {
        ...state,
        selection: { kind: "stop", stopId: action.stopId },
        searchIntent: { kind: "replace-anchor", stopId: action.stopId },
        searchQuery: "",
        dockMode: "edit",
        dockCollapsed: false,
      };
    case "search/query":
      return { ...state, searchQuery: action.value };
    case "device/touch":
      return { ...state, isTouchDevice: action.value };
    case "playback/play":
      return {
        ...state,
        playback:
          action.legIndex !== undefined
            ? jumpPlaybackToLegStart(
                { ...state.playback, status: "playing" },
                state.itinerary.legs,
                state.itinerary.stops,
                action.legIndex,
                "playing"
              )
            : { ...state.playback, status: "playing" },
        dockMode: "playback",
      };
    case "playback/pause":
      return {
        ...state,
        playback: { ...state.playback, status: "paused" },
      };
    case "playback/reset":
      return {
        ...state,
        playback: createInitialPlaybackState(),
      };
    case "playback/set-speed":
      return {
        ...state,
        playback: syncPlaybackState(
          { ...state.playback, speed: action.speed },
          state.itinerary.legs,
          state.itinerary.stops
        ),
      };
    case "playback/set-progress":
    case "playback/set-trip-progress":
      return {
        ...state,
        playback: syncPlaybackState(
          {
            ...state.playback,
            status:
              state.playback.status === "idle" ? "paused" : state.playback.status,
          },
          state.itinerary.legs,
          state.itinerary.stops,
          Math.max(0, Math.min(1, action.progress))
        ),
      };
    case "playback/jump-to-leg-start": {
      const legIndex = state.itinerary.legs.findIndex((leg) => leg.id === action.legId);
      return {
        ...state,
        selection: { kind: "leg", legId: action.legId },
        playback: jumpPlaybackToLegStart(
          state.playback,
          state.itinerary.legs,
          state.itinerary.stops,
          legIndex
        ),
      };
    }
    case "playback/jump-to-stop":
      return {
        ...state,
        selection: { kind: "stop", stopId: action.stopId },
        playback: syncPlaybackState(
          { ...state.playback, status: "paused" },
          state.itinerary.legs,
          state.itinerary.stops,
          getStopProgress(
            state.playback,
            state.itinerary.stops,
            state.itinerary.legs,
            action.stopId
          )
        ),
      };
    case "playback/recompute-frame":
      return {
        ...state,
        playback: syncPlaybackState(
          state.playback,
          state.itinerary.legs,
          state.itinerary.stops
        ),
      };
    case "playback/step-next":
      return {
        ...state,
        playback: syncPlaybackState(
          { ...state.playback, status: "paused" },
          state.itinerary.legs,
          state.itinerary.stops,
          getTimelineNavigationProgress(
            buildTimelineSegments(state.itinerary.legs, state.itinerary.stops),
            state.playback,
            "next"
          )
        ),
      };
    case "playback/step-prev":
      return {
        ...state,
        playback: syncPlaybackState(
          { ...state.playback, status: "paused" },
          state.itinerary.legs,
          state.itinerary.stops,
          getTimelineNavigationProgress(
            buildTimelineSegments(state.itinerary.legs, state.itinerary.stops),
            state.playback,
            "prev"
          )
        ),
      };
    case "playback/advance-frame":
      return {
        ...state,
        playback: advancePlaybackState(
          state.playback,
          state.itinerary.legs,
          state.itinerary.stops,
          action.deltaMs
        ),
      };
    default:
      return state;
  }
}
