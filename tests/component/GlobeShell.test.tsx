import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFixtureDataset, fixtureAirports, fixtureRoutes } from "../fixtures/dataset";

let globeProps: Record<string, (...args: unknown[]) => void> | null = null;

vi.mock("next/dynamic", () => ({
  default: () =>
    function MockDynamicComponent(props: Record<string, (...args: unknown[]) => void>) {
      globeProps = props;
      return (
        <div data-testid="globe-canvas-mock">
          <button type="button" onClick={() => props.onHoverStop?.("seed-stop-0", 12, 24)}>
            hover-stop
          </button>
          <button
            type="button"
            onClick={() => props.onHoverLeg?.("seed-stop-4__seed-stop-5", 18, 30)}
          >
            hover-leg
          </button>
          <button type="button" onClick={() => props.onClearHover?.()}>
            clear-hover
          </button>
          <button type="button" onClick={() => props.onSelectStop?.("seed-stop-1")}>
            select-stop
          </button>
          <button type="button" onClick={() => props.onSelectLeg?.("seed-stop-4__seed-stop-5")}>
            select-leg
          </button>
          <button type="button" onClick={() => props.onClearSelection?.()}>
            clear-selection
          </button>
        </div>
      );
    },
}));

vi.mock("../../lib/data/loadDataset", () => ({
  loadDataset: vi.fn(),
}));

import { loadDataset } from "../../lib/data/loadDataset";
import { getHoverContent, GlobeShell } from "../../components/globe/GlobeShell";

describe("GlobeShell", () => {
  beforeEach(() => {
    globeProps = null;
    process.env.NEXT_PUBLIC_E2E = "";
    window.history.replaceState({}, "", "/");
    vi.mocked(loadDataset).mockResolvedValue(createFixtureDataset());
  });

  it("shows the loading state and then renders the seeded itinerary", async () => {
    const user = userEvent.setup();
    render(<GlobeShell />);

    await waitFor(() => {
      expect(screen.getByTestId("dataset-status")).toHaveTextContent(
        `Loaded ${fixtureAirports.length} airports and ${fixtureRoutes.length} routes`
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId("itinerary-dock")).toHaveTextContent("Travel itinerary");
    });

    expect(screen.getByTestId("globe-canvas-mock")).toBeInTheDocument();
    expect(screen.getByTestId("itinerary-dock")).toHaveTextContent("Travel itinerary");
    expect(screen.getByTestId("trip-playback-bar")).toHaveTextContent("Vancouver to Porto");
    expect(screen.getByTestId("timeline-state")).toHaveTextContent("26 timeline segments");
    expect(globeProps?.safeAreaInsets).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByTestId("itinerary-panel")).toHaveTextContent("14 total");
    expect(screen.getAllByText("Lisbon, Portugal")).toHaveLength(2);
  });

  it("adds a stop from search and clears the query", async () => {
    const user = userEvent.setup();
    render(<GlobeShell />);

    await waitForElementToBeRemoved(() => screen.getByTestId("loading-overlay"));
    await user.type(screen.getByLabelText("Search airports"), "MAD");
    await user.click(
      screen.getByRole("button", {
        name: /adolfo suarez madrid-barajas airport/i,
      })
    );

    await waitFor(() => {
      expect(screen.getByText("15 total")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Search airports")).toHaveValue("");
  });

  it("hydrates selected stop and leg from the URL", async () => {
    window.history.replaceState({}, "", "/?stop=seed-stop-1");
    const view = render(<GlobeShell />);

    await waitForElementToBeRemoved(() => screen.getByTestId("loading-overlay"));
    await waitFor(() => {
      expect(window.location.search).toBe("?stop=seed-stop-1");
    });

    await userEvent.setup().click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByDisplayValue("Porto")).toBeInTheDocument();

    view.unmount();
    window.history.replaceState({}, "", "/?leg=seed-stop-4__seed-stop-5");
    render(<GlobeShell />);

    await waitForElementToBeRemoved(() => screen.getByTestId("loading-overlay"));
    await waitFor(() => {
      expect(window.location.search).toBe("?leg=seed-stop-4__seed-stop-5");
    });

    await userEvent.setup().click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByText("Leg editor")).toBeInTheDocument();
    expect(screen.getByText(/Lisbon to Barcelona/i)).toBeInTheDocument();
  });

  it("reacts to browser navigation after hydration", async () => {
    const user = userEvent.setup();
    render(<GlobeShell />);

    await waitForElementToBeRemoved(() => screen.getByTestId("loading-overlay"));
    await user.click(screen.getByRole("button", { name: "select-stop" }));
    await waitFor(() => {
      expect(screen.getByDisplayValue("Porto")).toBeInTheDocument();
    });

    await act(async () => {
      window.history.pushState({}, "", "/?stop=seed-stop-5");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue("Barcelona")).toBeInTheDocument();
    });
  });

  it("handles hover, selection, playback controls, and anchor replacement", async () => {
    const user = userEvent.setup();
    render(<GlobeShell />);

    await waitForElementToBeRemoved(() => screen.getByTestId("loading-overlay"));

    fireEvent.click(screen.getByRole("button", { name: "hover-stop" }));
    expect(screen.getByRole("status")).toHaveTextContent("Vancouver");

    fireEvent.click(screen.getByRole("button", { name: "hover-leg" }));
    expect(screen.getByRole("status")).toHaveTextContent("Lisbon -> Barcelona");

    fireEvent.click(screen.getByRole("button", { name: "clear-hover" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "select-leg" }));
    expect(screen.getByText("Leg editor")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ground" }));
    expect(screen.getByTestId("selected-leg-mode")).toHaveTextContent("ground");
    fireEvent.click(screen.getByRole("button", { name: "Play this leg" }));
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    await act(async () => {
      globeProps?.onAutoFollowSuspendedChange?.(true);
    });
    expect(screen.getAllByRole("button", { name: "Recenter" })).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Recenter" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(screen.getByLabelText("Playback speed"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText(/Trip progress:/), { target: { value: "20" } });

    fireEvent.click(screen.getByRole("button", { name: "select-stop" }));
    expect(screen.getByDisplayValue("Porto")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Replace anchor with search" }));
    expect(screen.getByPlaceholderText("Replace anchor with a city or airport")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Search airports"), "FAO");
    await user.click(screen.getByRole("button", { name: /faro airport/i }));
    await waitFor(() => {
      expect(screen.getByDisplayValue("Faro")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /1. Vancouver/i }));
    fireEvent.click(screen.getAllByRole("button", { name: "Up" })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "Down" })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "Insert after" })[0]);
    fireEvent.change(screen.getByLabelText("Label"), { target: { value: "Vancouver Hub" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[1]);
    fireEvent.click(screen.getByRole("button", { name: "clear-selection" }));
    fireEvent.click(screen.getByRole("button", { name: "Playback" }));

    expect(screen.queryByText("Nothing selected")).not.toBeInTheDocument();
  }, 10000);

  it("registers the E2E test API when enabled", async () => {
    process.env.NEXT_PUBLIC_E2E = "1";
    const view = render(<GlobeShell />);

    await waitFor(() => {
      expect(window.__GLOBAL_PLANNER_TEST_API__).toBeDefined();
    });
    await waitFor(() => {
      expect(screen.getByTestId("dataset-status")).toHaveTextContent(
        `Loaded ${fixtureAirports.length} airports and ${fixtureRoutes.length} routes`
      );
    });

      await act(async () => {
        window.__GLOBAL_PLANNER_TEST_API__?.selectLeg("seed-stop-4__seed-stop-5");
        window.__GLOBAL_PLANNER_TEST_API__?.selectLeg("missing");
        window.__GLOBAL_PLANNER_TEST_API__?.selectStop("seed-stop-1");
        window.__GLOBAL_PLANNER_TEST_API__?.selectStop("missing");
      globeProps?.onCameraStateChange?.({
        mode: "overview",
        targetPointOfView: { lat: 20, lng: -32, altitude: 1.62 },
          currentPointOfView: { lat: 20, lng: -32, altitude: 1.62 },
          autoFollowSuspended: false,
        });
        globeProps?.onRenderStateChange?.({
          visibleLabelCount: 0,
          visiblePathCount: 7,
          visibleStopCount: 4,
          playbackStatus: "playing",
          activeLegIndex: 1,
        });
      });

    await waitFor(() => {
      const apiState = window.__GLOBAL_PLANNER_TEST_API__?.getState();
      expect(apiState?.stopCount).toBe(14);
      expect(apiState?.legCount).toBe(13);
      expect(apiState?.playbackStatus).toBe("idle");
      expect(apiState?.activeLegIndex).toBe(0);
      expect(apiState?.tripProgress).toBe(0);
      expect(window.__GLOBAL_PLANNER_TEST_API__?.getCameraState()).not.toBeNull();
      expect(window.__GLOBAL_PLANNER_TEST_API__?.getRenderState()).toEqual({
        visibleLabelCount: 0,
        visiblePathCount: 7,
        visibleStopCount: 4,
        playbackStatus: "playing",
        activeLegIndex: 1,
      });
    });

    view.unmount();
    expect(window.__GLOBAL_PLANNER_TEST_API__).toBeUndefined();
  });

  it("renders the load error state and retries", async () => {
    vi.mocked(loadDataset).mockRejectedValueOnce(new Error("load failed"));
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...window.location,
        reload,
      },
    });

    render(<GlobeShell />);

    await waitFor(() => {
      expect(screen.getByText("Global Planner could not start.")).toBeInTheDocument();
    });
    await userEvent.setup().click(screen.getByRole("button", { name: "Retry" }));
    expect(reload).toHaveBeenCalled();
  });

  it("builds hover content for stops and legs and handles missing data", () => {
    const dataset = createFixtureDataset();
    const stops = [
      {
        id: "seed-stop-0",
        kind: "origin" as const,
        label: "Vancouver",
        city: "Vancouver",
        country: "Canada",
        anchorAirportId: "1",
        lat: 49.1947,
        lon: -123.1792,
        arrivalDate: null,
        departureDate: "2026-02-20",
        dayCount: null,
        notes: "",
        unresolved: false,
      },
      {
        id: "seed-stop-1",
        kind: "stay" as const,
        label: "Porto",
        city: "Porto",
        country: "Portugal",
        anchorAirportId: "2",
        lat: 41.2481,
        lon: -8.6814,
        arrivalDate: "2026-02-21",
        departureDate: "2026-03-02",
        dayCount: 9,
        notes: "",
        unresolved: false,
      },
      {
        id: "seed-stop-2",
        kind: "stay" as const,
        label: "Unresolved Porto",
        city: "Porto",
        country: "Portugal",
        anchorAirportId: null,
        lat: null,
        lon: null,
        arrivalDate: "2026-03-03",
        departureDate: "2026-03-04",
        dayCount: 1,
        notes: "",
        unresolved: true,
      },
    ];
    const legs = [
      {
        id: "seed-stop-0__seed-stop-1",
        fromStopId: "seed-stop-0",
        toStopId: "seed-stop-1",
        mode: "air" as const,
        distanceKm: dataset.routes[0].distanceKm,
        pathPoints: [
          { lat: 49.1947, lon: -123.1792, altitude: 0.04 },
          { lat: 41.2481, lon: -8.6814, altitude: 0.18 },
        ],
      },
      {
        id: "seed-stop-1__seed-stop-2",
        fromStopId: "seed-stop-1",
        toStopId: "seed-stop-2",
        mode: "ground" as const,
        distanceKm: null,
        pathPoints: [
          { lat: 41.2481, lon: -8.6814, altitude: 0.002 },
          { lat: 41.25, lon: -8.69, altitude: 0.002 },
        ],
      },
    ];

    expect(
      getHoverContent({ kind: "stop", stopId: "seed-stop-0", x: 10, y: 20 }, stops, legs)
    ).toEqual({
      x: 10,
      y: 20,
      title: "Vancouver",
      lines: ["Vancouver, Canada", "Unscheduled -> Feb 20, 2026", "Origin stop"],
    });
    expect(
      getHoverContent({ kind: "stop", stopId: "seed-stop-2", x: 5, y: 6 }, stops, legs)
    ).toEqual({
      x: 5,
      y: 6,
      title: "Unresolved Porto",
      lines: ["Porto, Portugal", "Mar 3, 2026 -> Mar 4, 2026", "Anchor unresolved"],
    });
    expect(
      getHoverContent({ kind: "stop", stopId: "seed-stop-1", x: 7, y: 8 }, stops, legs)
    ).toEqual({
      x: 7,
      y: 8,
      title: "Porto",
      lines: ["Porto, Portugal", "Feb 21, 2026 -> Mar 2, 2026", "9 days"],
    });
    expect(
      getHoverContent({ kind: "leg", legId: "seed-stop-0__seed-stop-1", x: 1, y: 2 }, stops, legs)
    ).toEqual({
      x: 1,
      y: 2,
      title: "Vancouver -> Porto",
      lines: ["Air leg", "7,490 km", "Vancouver, Canada to Porto, Portugal"],
    });
    expect(
      getHoverContent({ kind: "leg", legId: "seed-stop-1__seed-stop-2", x: 3, y: 4 }, stops, legs)
    ).toEqual({
      x: 3,
      y: 4,
      title: "Porto -> Unresolved Porto",
      lines: ["Ground leg", "Distance unavailable", "Porto, Portugal to Porto, Portugal"],
    });
    expect(getHoverContent(null, stops, legs)).toBeNull();
    expect(
      getHoverContent({ kind: "stop", stopId: "missing", x: 0, y: 0 }, stops, legs)
    ).toBeNull();
    expect(
      getHoverContent({ kind: "leg", legId: "missing", x: 0, y: 0 }, stops, legs)
    ).toBeNull();
    expect(
      getHoverContent(
        { kind: "leg", legId: "seed-stop-0__seed-stop-1", x: 0, y: 0 },
        [stops[0]],
        legs
      )
    ).toBeNull();
  });
});
