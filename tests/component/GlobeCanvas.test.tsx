import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GlobeCanvas } from "../../components/globe/GlobeCanvas";
import { createFixtureDataset } from "../fixtures/dataset";

let latestGlobeProps: Record<string, unknown> | null = null;
let shouldAttachRef = true;
let resizeCallback:
  | ((entries: Array<{ contentRect: { width: number; height: number } }>) => void)
  | null = null;

const controls = {
  enableDamping: false,
  dampingFactor: 0,
  minDistance: 0,
  maxDistance: 0,
  rotateSpeed: 0,
  zoomSpeed: 0,
};

const globeApi = {
  getScreenCoords: vi.fn(() => ({ x: 90, y: 120 })),
  controls: vi.fn(() => controls),
  pointOfView: vi.fn((pov?: { lat: number; lng: number; altitude: number }) => {
    if (!pov) {
      return { lat: 0, lng: 0, altitude: 2 };
    }
    return globeApi;
  }),
};

vi.mock("react-globe.gl", async () => {
  const ReactModule = await import("react");

  const MockGlobe = ReactModule.forwardRef((props: Record<string, unknown>, ref) => {
    latestGlobeProps = props;
    ReactModule.useImperativeHandle(ref, () =>
      shouldAttachRef ? globeApi : undefined
    );
    return <div data-testid="mock-globe" />;
  });

  return {
    default: MockGlobe,
  };
});

describe("GlobeCanvas", () => {
  beforeEach(() => {
    latestGlobeProps = null;
    shouldAttachRef = true;
    globeApi.getScreenCoords.mockReset();
    globeApi.getScreenCoords.mockReturnValue({ x: 90, y: 120 });
    globeApi.controls.mockClear();
    globeApi.pointOfView.mockReset();
    globeApi.pointOfView.mockImplementation((pov?: { lat: number; lng: number; altitude: number }) => {
      if (!pov) {
        return { lat: 0, lng: 0, altitude: 2 };
      }
      return globeApi;
    });
    resizeCallback = null;

    window.ResizeObserver = class {
      constructor(callback: typeof resizeCallback) {
        resizeCallback = callback;
      }

      observe() {}
      disconnect() {}
      unobserve() {}
    } as unknown as typeof ResizeObserver;
  });

  it("renders globe props, syncs size, and configures controls", async () => {
    const dataset = createFixtureDataset();

    render(
      <GlobeCanvas
        airports={dataset.airports}
        routes={dataset.routes}
        indexes={dataset.indexes}
        selection={{ kind: "airport", airportId: "3797" }}
        enableHover
        onHoverAirport={vi.fn()}
        onHoverRoute={vi.fn()}
        onClearHover={vi.fn()}
        onSelectAirport={vi.fn()}
        onSelectRoute={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );

    expect(screen.getByTestId("mock-globe")).toBeInTheDocument();

    await act(async () => {
      resizeCallback?.([{ contentRect: { width: 700, height: 500 } }]);
    });

    expect(globeApi.controls).toHaveBeenCalled();
    expect(controls.enableDamping).toBe(true);
    expect(controls.maxDistance).toBe(360);
    expect(globeApi.pointOfView).toHaveBeenCalledWith(
      { lat: 22, lng: -32, altitude: 2.05 },
      0
    );
    expect(globeApi.pointOfView).toHaveBeenCalledWith(
      { lat: 40.6413, lng: -73.7781, altitude: 1.6 },
      900
    );
    expect(latestGlobeProps?.width).toBe(700);
    expect(latestGlobeProps?.height).toBe(500);
    expect(latestGlobeProps?.globeImageUrl).toBe("/textures/earth-day.jpg");
    expect(latestGlobeProps?.bumpImageUrl).toBe("/textures/earth-topology.png");
    expect(Array.isArray(latestGlobeProps?.polygonsData)).toBe(true);
    expect((latestGlobeProps?.polygonsData as object[]).length).toBeGreaterThan(150);
    expect((latestGlobeProps?.polygonCapColor as () => string)()).toBe("rgba(0, 0, 0, 0)");
    expect((latestGlobeProps?.polygonSideColor as () => string)()).toBe("rgba(0, 0, 0, 0)");
    expect((latestGlobeProps?.polygonStrokeColor as () => string)()).toBe(
      "rgba(221, 243, 255, 0.36)"
    );
    expect(latestGlobeProps?.polygonAltitude).toBe(0.002);
    expect((latestGlobeProps?.pointAltitude as (obj: object) => number)(dataset.airports[0])).toBe(
      0.018
    );
    expect((latestGlobeProps?.pointAltitude as (obj: object) => number)(dataset.airports[1])).toBe(
      0.009
    );
    expect((latestGlobeProps?.pointColor as (obj: object) => string)(dataset.airports[0])).toBe(
      "#ffd18f"
    );
    expect((latestGlobeProps?.pointColor as (obj: object) => string)(dataset.airports[1])).toBe(
      "rgba(190, 242, 255, 0.78)"
    );
    expect((latestGlobeProps?.pointRadius as (obj: object) => number)(dataset.airports[0])).toBe(
      0.22
    );
    expect((latestGlobeProps?.pointRadius as (obj: object) => number)(dataset.airports[1])).toBe(
      0.11
    );
    expect((latestGlobeProps?.arcColor as (obj: object) => string)(dataset.routes[0])).toBe(
      "rgba(108, 228, 255, 0.08)"
    );
    expect((latestGlobeProps?.arcStartLng as (obj: object) => number)(dataset.routes[0])).toBe(
      -73.7781
    );
    expect((latestGlobeProps?.arcEndLat as (obj: object) => number)(dataset.routes[0])).toBe(
      51.47
    );
  });

  it("handles hover and click callbacks", async () => {
    const dataset = createFixtureDataset();
    const onHoverAirport = vi.fn();
    const onHoverRoute = vi.fn();
    const onClearHover = vi.fn();
    const onSelectAirport = vi.fn();
    const onSelectRoute = vi.fn();
    const onClearSelection = vi.fn();

    render(
      <GlobeCanvas
        airports={dataset.airports}
        routes={dataset.routes}
        indexes={dataset.indexes}
        selection={{ kind: "route", routeId: "3797__507", airportId: "3797" }}
        enableHover
        onHoverAirport={onHoverAirport}
        onHoverRoute={onHoverRoute}
        onClearHover={onClearHover}
        onSelectAirport={onSelectAirport}
        onSelectRoute={onSelectRoute}
        onClearSelection={onClearSelection}
      />
    );

    const props = latestGlobeProps as Record<string, (arg?: object | null) => void>;
    globeApi.getScreenCoords.mockReturnValueOnce(null).mockReturnValueOnce(null);
    props.onPointHover?.(dataset.airports[0]);
    props.onArcHover?.(dataset.routes[0]);
    props.onPointHover?.(null);
    props.onArcHover?.(null);
    props.onPointClick?.(dataset.airports[1]);
    props.onArcClick?.(dataset.routes[0]);
    props.onGlobeClick?.();

    expect(onHoverAirport).toHaveBeenCalledWith("3797", 0, 0);
    expect(onHoverRoute).toHaveBeenNthCalledWith(1, "3797__507", 0, 0);
    expect(onClearHover).toHaveBeenCalledTimes(3);
    expect(onSelectAirport).toHaveBeenCalledWith("507");
    expect(onSelectRoute).toHaveBeenCalledWith("3797__507", "3797");
    expect(onClearSelection).toHaveBeenCalled();
    expect((latestGlobeProps?.arcStroke as (obj: object) => number)(dataset.routes[0])).toBeGreaterThan(0.18);
    expect((latestGlobeProps?.arcColor as (obj: object) => string)(dataset.routes[0])).toBe(
      "rgba(255, 184, 112, 0.9)"
    );
    expect((latestGlobeProps?.arcStartLat as (obj: object) => number)(dataset.routes[0])).toBe(40.6413);
    expect((latestGlobeProps?.arcEndLng as (obj: object) => number)(dataset.routes[0])).toBe(-0.4543);
  });

  it("covers disabled hover and missing globe/index cases", async () => {
    const dataset = createFixtureDataset();
    const incompleteIndexes = {
      ...dataset.indexes,
      airportsById: new Map(dataset.indexes.airportsById),
    };
    incompleteIndexes.airportsById.delete("507");
    shouldAttachRef = false;

    render(
      <GlobeCanvas
        airports={dataset.airports}
        routes={dataset.routes}
        indexes={incompleteIndexes}
        selection={null}
        enableHover={false}
        onHoverAirport={vi.fn()}
        onHoverRoute={vi.fn()}
        onClearHover={vi.fn()}
        onSelectAirport={vi.fn()}
        onSelectRoute={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );

    const props = latestGlobeProps as Record<string, (arg?: object | null) => void>;
    expect(() => props.onPointHover?.(dataset.airports[0])).not.toThrow();
    expect(() => props.onArcHover?.(dataset.routes[0])).not.toThrow();
    expect(() =>
      (props.arcStartLng as (obj: object) => number)({
        airportAId: "missing",
        airportBId: "missing",
        distanceKm: 1000,
        id: "x",
      })
    ).not.toThrow();
    expect(
      (props.arcStartLat as (obj: object) => number)({
        airportAId: "missing",
        airportBId: "missing",
        distanceKm: 1000,
        id: "x",
      })
    ).toBe(0);
    expect(
      (props.arcStartLng as (obj: object) => number)({
        airportAId: "missing",
        airportBId: "missing",
        distanceKm: 1000,
        id: "x",
      })
    ).toBe(0);
    expect(
      (props.arcEndLat as (obj: object) => number)({
        airportAId: "missing",
        airportBId: "missing",
        distanceKm: 1000,
        id: "x",
      })
    ).toBe(0);
    expect(
      (props.arcEndLng as (obj: object) => number)({
        airportAId: "missing",
        airportBId: "missing",
        distanceKm: 1000,
        id: "x",
      })
    ).toBe(0);
    expect(
      (props.arcAltitude as (obj: object) => number)({
        distanceKm: 1000,
      })
    ).toBeGreaterThan(0);
  });

  it("covers missing route endpoints during hover and empty resize entries", async () => {
    const dataset = createFixtureDataset();
    const incompleteIndexes = {
      ...dataset.indexes,
      airportsById: new Map(dataset.indexes.airportsById),
    };
    incompleteIndexes.airportsById.delete("507");
    const onHoverRoute = vi.fn();

    render(
      <GlobeCanvas
        airports={dataset.airports}
        routes={dataset.routes}
        indexes={incompleteIndexes}
        selection={null}
        enableHover
        onHoverAirport={vi.fn()}
        onHoverRoute={onHoverRoute}
        onClearHover={vi.fn()}
        onSelectAirport={vi.fn()}
        onSelectRoute={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );

    const props = latestGlobeProps as Record<string, (arg?: object | null) => void>;

    await act(async () => {
      resizeCallback?.([]);
    });

    props.onArcHover?.(dataset.routes[0]);

    expect(latestGlobeProps?.width).toBe(1280);
    expect(latestGlobeProps?.height).toBe(720);
    expect(onHoverRoute).toHaveBeenCalledWith("3797__507", 0, 0);
  });

  it("covers close fly-to transitions and missing selected airports", () => {
    const dataset = createFixtureDataset();
    const indexesWithoutSelected = {
      ...dataset.indexes,
      airportsById: new Map(dataset.indexes.airportsById),
    };
    indexesWithoutSelected.airportsById.delete("3797");
    let readCount = 0;
    globeApi.pointOfView.mockImplementation((pov?: { lat: number; lng: number; altitude: number }) => {
      if (!pov) {
        readCount += 1;
        return readCount === 1
          ? { lat: 40.7, lng: -73.7, altitude: 2 }
          : { lat: 0, lng: 0, altitude: 2 };
      }
      return globeApi;
    });

    const { rerender } = render(
      <GlobeCanvas
        airports={dataset.airports}
        routes={dataset.routes}
        indexes={dataset.indexes}
        selection={{ kind: "airport", airportId: "3797" }}
        enableHover
        onHoverAirport={vi.fn()}
        onHoverRoute={vi.fn()}
        onClearHover={vi.fn()}
        onSelectAirport={vi.fn()}
        onSelectRoute={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );

    expect(globeApi.pointOfView).toHaveBeenCalledWith(
      { lat: 40.6413, lng: -73.7781, altitude: 1.6 },
      450
    );

    rerender(
      <GlobeCanvas
        airports={dataset.airports}
        routes={dataset.routes}
        indexes={indexesWithoutSelected}
        selection={{ kind: "airport", airportId: "3797" }}
        enableHover
        onHoverAirport={vi.fn()}
        onHoverRoute={vi.fn()}
        onClearHover={vi.fn()}
        onSelectAirport={vi.fn()}
        onSelectRoute={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );

    expect(globeApi.pointOfView).toHaveBeenCalledTimes(3);
  });
});
