import type {
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
import { createInitialPlaybackState, advancePlaybackState } from "../itinerary/playback";
import { buildStopFromAirport, getDayCount } from "../itinerary/resolveStops";

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
  | { type: "playback/set-progress"; progress: number }
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
  itinerary: {
    stops: [],
    legs: [],
    selectedInsertIndex: null,
    nextStopOrdinal: 1,
  },
  playback: createInitialPlaybackState(),
};

function rebuildLegs(stops: ItineraryStop[], existingLegs: ItineraryLeg[]) {
  return deriveLegs(stops, existingLegs);
}

function setLegMode(legs: ItineraryLeg[], legId: string, mode: TravelMode) {
  return legs.map((leg) => {
    if (leg.id !== legId) {
      return leg;
    }

    return {
      ...leg,
      mode,
      pathPoints: leg.pathPoints.map((point) => ({
        ...point,
        altitude: mode === "air" ? point.altitude || 0.04 : 0.002,
      })),
    };
  });
}

function getStopIndex(stops: ItineraryStop[], stopId: string) {
  return stops.findIndex((stop) => stop.id === stopId);
}

function normalizeStopsForDates(stops: ItineraryStop[]) {
  return stops.map((stop) => ({
    ...stop,
    dayCount: getDayCount(stop.arrivalDate, stop.departureDate),
  }));
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "dataset/loading":
      return {
        ...state,
        loadState: { status: "loading" },
      };
    case "dataset/loaded":
      return {
        ...state,
        loadState: { status: "ready", dataset: action.dataset },
      };
    case "dataset/error":
      return {
        ...state,
        loadState: { status: "error", message: action.message },
      };
    case "hover/stop":
      return {
        ...state,
        hover: {
          kind: "stop",
          stopId: action.stopId,
          x: action.x,
          y: action.y,
        },
      };
    case "hover/leg":
      return {
        ...state,
        hover: {
          kind: "leg",
          legId: action.legId,
          x: action.x,
          y: action.y,
        },
      };
    case "hover/clear":
      return {
        ...state,
        hover: null,
      };
    case "selection/hydrate":
      return {
        ...state,
        selection: action.selection,
        hasHydratedUrl: true,
      };
    case "selection/clear":
      return {
        ...state,
        selection: null,
        hasHydratedUrl: true,
      };
    case "itinerary/seed":
      return {
        ...state,
        itinerary: {
          ...state.itinerary,
          stops: action.stops,
          legs: rebuildLegs(action.stops, []),
          nextStopOrdinal: action.stops.length + 1,
        },
      };
    case "itinerary/select-stop":
      return {
        ...state,
        selection: { kind: "stop", stopId: action.stopId },
        hasHydratedUrl: true,
        itinerary: {
          ...state.itinerary,
          selectedInsertIndex: getStopIndex(state.itinerary.stops, action.stopId),
        },
        playback: {
          ...state.playback,
          status: state.playback.status === "playing" ? "paused" : state.playback.status,
        },
      };
    case "itinerary/select-leg":
      return {
        ...state,
        selection: { kind: "leg", legId: action.legId },
        hasHydratedUrl: true,
        playback: {
          ...state.playback,
          activeLegIndex: Math.max(
            0,
            state.itinerary.legs.findIndex((leg) => leg.id === action.legId)
          ),
          progress: 0,
          status: state.playback.status === "playing" ? "playing" : "paused",
          dwellRemainingMs: 0,
        },
      };
    case "itinerary/add-stop": {
      const insertAfterIndex =
        state.searchIntent.kind === "replace-anchor"
          ? null
          : state.itinerary.selectedInsertIndex ??
            (state.selection?.kind === "stop"
              ? getStopIndex(state.itinerary.stops, state.selection.stopId)
              : state.itinerary.stops.length - 1);

      if (state.searchIntent.kind === "replace-anchor") {
        const stops = normalizeStopsForDates(
          state.itinerary.stops.map((stop) =>
            stop.id === state.searchIntent.stopId
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

        return {
          ...state,
          searchQuery: "",
          searchIntent: { kind: "add" },
          itinerary: {
            ...state.itinerary,
            stops,
            legs: rebuildLegs(stops, state.itinerary.legs),
          },
          selection: { kind: "stop", stopId: state.searchIntent.stopId },
        };
      }

      const newStop = buildStopFromAirport(
        action.airport,
        state.itinerary.nextStopOrdinal
      );
      const stops = [...state.itinerary.stops];
      const insertAt = Math.min(stops.length, (insertAfterIndex ?? stops.length - 1) + 1);
      stops.splice(insertAt, 0, newStop);
      const normalizedStops = normalizeStopsForDates(stops);

      return {
        ...state,
        searchQuery: "",
        itinerary: {
          ...state.itinerary,
          stops: normalizedStops,
          legs: rebuildLegs(normalizedStops, state.itinerary.legs),
          selectedInsertIndex: insertAt,
          nextStopOrdinal: state.itinerary.nextStopOrdinal + 1,
        },
        selection: { kind: "stop", stopId: newStop.id },
      };
    }
    case "itinerary/update-stop": {
      const stops = normalizeStopsForDates(
        state.itinerary.stops.map((stop) =>
          stop.id === action.stopId ? { ...stop, ...action.patch } : stop
        )
      );

      return {
        ...state,
        itinerary: {
          ...state.itinerary,
          stops,
          legs: rebuildLegs(stops, state.itinerary.legs),
        },
      };
    }
    case "itinerary/remove-stop": {
      const stops = state.itinerary.stops.filter((stop) => stop.id !== action.stopId);
      const legs = rebuildLegs(stops, state.itinerary.legs);
      const nextSelection =
        state.selection?.kind === "stop" && state.selection.stopId === action.stopId
          ? null
          : state.selection?.kind === "leg" &&
              !legs.some((leg) => leg.id === state.selection?.legId)
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
      };
    }
    case "itinerary/move-stop-up": {
      const index = getStopIndex(state.itinerary.stops, action.stopId);
      if (index <= 0) {
        return state;
      }

      const stops = [...state.itinerary.stops];
      [stops[index - 1], stops[index]] = [stops[index], stops[index - 1]];

      return {
        ...state,
        itinerary: {
          ...state.itinerary,
          stops,
          legs: rebuildLegs(stops, state.itinerary.legs),
          selectedInsertIndex: index - 1,
        },
      };
    }
    case "itinerary/move-stop-down": {
      const index = getStopIndex(state.itinerary.stops, action.stopId);
      if (index < 0 || index >= state.itinerary.stops.length - 1) {
        return state;
      }

      const stops = [...state.itinerary.stops];
      [stops[index], stops[index + 1]] = [stops[index + 1], stops[index]];

      return {
        ...state,
        itinerary: {
          ...state.itinerary,
          stops,
          legs: rebuildLegs(stops, state.itinerary.legs),
          selectedInsertIndex: index + 1,
        },
      };
    }
    case "itinerary/set-leg-mode": {
      const legs = setLegMode(state.itinerary.legs, action.legId, action.mode);

      return {
        ...state,
        itinerary: {
          ...state.itinerary,
          legs,
        },
      };
    }
    case "itinerary/set-insert-index":
      return {
        ...state,
        itinerary: {
          ...state.itinerary,
          selectedInsertIndex: action.index,
        },
      };
    case "itinerary/replace-anchor":
      return {
        ...state,
        selection: { kind: "stop", stopId: action.stopId },
        searchIntent: { kind: "replace-anchor", stopId: action.stopId },
        searchQuery: "",
      };
    case "search/query":
      return {
        ...state,
        searchQuery: action.value,
      };
    case "device/touch":
      return {
        ...state,
        isTouchDevice: action.value,
      };
    case "playback/play":
      return {
        ...state,
        playback: {
          ...state.playback,
          status: "playing",
          activeLegIndex: action.legIndex ?? state.playback.activeLegIndex,
          progress:
            action.legIndex !== undefined &&
            action.legIndex !== state.playback.activeLegIndex
              ? 0
              : state.playback.progress,
          dwellRemainingMs: 0,
        },
      };
    case "playback/pause":
      return {
        ...state,
        playback: {
          ...state.playback,
          status: "paused",
        },
      };
    case "playback/reset":
      return {
        ...state,
        playback: createInitialPlaybackState(),
      };
    case "playback/set-speed":
      return {
        ...state,
        playback: {
          ...state.playback,
          speed: action.speed,
        },
      };
    case "playback/set-progress":
      return {
        ...state,
        playback: {
          ...state.playback,
          progress: Math.max(0, Math.min(1, action.progress)),
          status: state.playback.status === "idle" ? "paused" : state.playback.status,
        },
      };
    case "playback/step-next":
      return {
        ...state,
        playback: {
          ...state.playback,
          activeLegIndex: Math.min(
            Math.max(0, state.itinerary.legs.length - 1),
            state.playback.activeLegIndex + 1
          ),
          progress: 0,
          dwellRemainingMs: 0,
          status: "paused",
        },
      };
    case "playback/step-prev":
      return {
        ...state,
        playback: {
          ...state.playback,
          activeLegIndex: Math.max(0, state.playback.activeLegIndex - 1),
          progress: 0,
          dwellRemainingMs: 0,
          status: "paused",
        },
      };
    case "playback/advance-frame":
      return {
        ...state,
        playback: advancePlaybackState(
          state.playback,
          state.itinerary.legs,
          action.deltaMs
        ),
      };
    default:
      return state;
  }
}
