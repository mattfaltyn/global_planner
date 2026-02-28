import type {
  HoverState,
  LoadedDataset,
  RouteSortKey,
  SelectionState,
} from "../data/types";

export type LoadState =
  | { status: "idle" | "loading" }
  | { status: "ready"; dataset: LoadedDataset }
  | { status: "error"; message: string };

export type AppState = {
  loadState: LoadState;
  hover: HoverState;
  selection: SelectionState;
  hasHydratedUrl: boolean;
  searchQuery: string;
  panelFilterQuery: string;
  panelSortKey: RouteSortKey;
  isTouchDevice: boolean;
};

export type AppAction =
  | { type: "dataset/loading" }
  | { type: "dataset/loaded"; dataset: LoadedDataset }
  | { type: "dataset/error"; message: string }
  | { type: "hover/airport"; airportId: string; x: number; y: number }
  | { type: "hover/route"; routeId: string; x: number; y: number }
  | { type: "hover/clear" }
  | { type: "selection/airport"; airportId: string }
  | { type: "selection/route"; routeId: string; airportId: string }
  | { type: "selection/hydrate"; selection: SelectionState }
  | { type: "selection/clear" }
  | { type: "search/query"; value: string }
  | { type: "panel/filter"; value: string }
  | { type: "panel/sort"; value: RouteSortKey }
  | { type: "device/touch"; value: boolean };

export const initialAppState: AppState = {
  loadState: { status: "idle" },
  hover: null,
  selection: null,
  hasHydratedUrl: false,
  searchQuery: "",
  panelFilterQuery: "",
  panelSortKey: "name",
  isTouchDevice: false,
};

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
    case "hover/airport":
      return {
        ...state,
        hover: {
          kind: "airport",
          airportId: action.airportId,
          x: action.x,
          y: action.y,
        },
      };
    case "hover/route":
      return {
        ...state,
        hover: {
          kind: "route",
          routeId: action.routeId,
          x: action.x,
          y: action.y,
        },
      };
    case "hover/clear":
      return {
        ...state,
        hover: null,
      };
    case "selection/airport":
      return {
        ...state,
        selection: {
          kind: "airport",
          airportId: action.airportId,
        },
        hasHydratedUrl: true,
        panelFilterQuery: "",
      };
    case "selection/route":
      return {
        ...state,
        selection: {
          kind: "route",
          routeId: action.routeId,
          airportId: action.airportId,
        },
        hasHydratedUrl: true,
      };
    case "selection/hydrate":
      return {
        ...state,
        selection: action.selection,
        hasHydratedUrl: true,
        panelFilterQuery: "",
      };
    case "selection/clear":
      return {
        ...state,
        selection: null,
        hasHydratedUrl: true,
        panelFilterQuery: "",
      };
    case "search/query":
      return {
        ...state,
        searchQuery: action.value,
      };
    case "panel/filter":
      return {
        ...state,
        panelFilterQuery: action.value,
      };
    case "panel/sort":
      return {
        ...state,
        panelSortKey: action.value,
      };
    case "device/touch":
      return {
        ...state,
        isTouchDevice: action.value,
      };
    default:
      return state;
  }
}
