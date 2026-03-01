import React from "react";
import {
  act,
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFixtureDataset } from "../fixtures/dataset";

let globeProps: Record<string, (...args: unknown[]) => void> | null = null;

vi.mock("next/dynamic", () => ({
  default: () => function MockDynamicComponent(props: Record<string, (...args: unknown[]) => void>) {
    globeProps = props;
    return (
      <div data-testid="globe-canvas-mock">
        <button type="button" onClick={() => props.onHoverAirport?.("3797", 12, 24)}>
          hover-airport
        </button>
        <button type="button" onClick={() => props.onHoverRoute?.("3797__507", 18, 30)}>
          hover-route
        </button>
        <button type="button" onClick={() => props.onClearHover?.()}>
          clear-hover
        </button>
        <button type="button" onClick={() => props.onSelectAirport?.("3797")}>
          select-airport
        </button>
        <button type="button" onClick={() => props.onSelectRoute?.("3797__507", "3797")}>
          select-route
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
import { SidePanel } from "../../components/ui/SidePanel";

describe("GlobeShell", () => {
  beforeEach(() => {
    globeProps = null;
    process.env.NEXT_PUBLIC_E2E = "";
    window.history.replaceState({}, "", "/");
    vi.mocked(loadDataset).mockResolvedValue(createFixtureDataset());
  });

  it("shows a loading state and then renders the dataset", async () => {
    render(<GlobeShell />);

    expect(screen.getByTestId("loading-overlay")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("dataset-status")).toHaveTextContent("Loaded 3 airports and 2 routes");
    });

    expect(screen.getByTestId("dataset-status")).toHaveTextContent("Loaded 3 airports and 2 routes");
    expect(screen.getByTestId("globe-canvas-mock")).toBeInTheDocument();
  });

  it("searches and selects an airport, updating the URL", async () => {
    const user = userEvent.setup();
    render(<GlobeShell />);

    await waitFor(() => {
      expect(screen.getByTestId("dataset-status")).toHaveTextContent("Loaded 3 airports and 2 routes");
    });
    await user.type(screen.getByLabelText("Search airports"), "JFK");
    await user.click(screen.getByRole("button", { name: /john f kennedy international airport/i }));

    await waitFor(() => {
      expect(window.location.search).toContain("airport=3797");
    });

    expect(screen.getByTestId("side-panel")).toHaveTextContent("John F Kennedy International Airport");
  });

  it("hydrates route detail from URL params", async () => {
    window.history.replaceState({}, "", "/?airport=3797&route=3797__507");
    render(<GlobeShell />);

    await waitFor(() => {
      expect(screen.getByTestId("dataset-status")).toHaveTextContent("Loaded 3 airports and 2 routes");
    });

    await waitFor(() => {
      expect(screen.getByTestId("side-panel")).toHaveTextContent("Route detail");
      expect(screen.getByTestId("side-panel")).toHaveTextContent("Heathrow Airport");
      expect(window.location.search).toBe("?airport=3797&route=3797__507");
    });
  });

  it("reacts to browser navigation after hydration", async () => {
    render(<GlobeShell />);

    await waitForElementToBeRemoved(() => screen.getByTestId("loading-overlay"));
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      window.history.replaceState({}, "", "/?airport=507");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("side-panel")).toHaveTextContent("Heathrow Airport");
    });
  });

  it("handles hover, panel callbacks, and clear selection", async () => {
    const user = userEvent.setup();
    render(<GlobeShell />);

    await waitForElementToBeRemoved(() => screen.getByTestId("loading-overlay"));

    await user.click(screen.getByRole("button", { name: "hover-airport" }));
    expect(screen.getByRole("status")).toHaveTextContent("John F Kennedy International Airport");

    await user.click(screen.getByRole("button", { name: "hover-route" }));
    expect(screen.getByRole("status")).toHaveTextContent("Heathrow Airport");

    await user.click(screen.getByRole("button", { name: "clear-hover" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "select-airport" }));
    expect(screen.getByTestId("side-panel")).toHaveTextContent(
      "John F Kennedy International Airport"
    );

    await user.clear(screen.getByPlaceholderText("Filter destinations"));
    await user.type(screen.getByPlaceholderText("Filter destinations"), "lon");
    await user.selectOptions(screen.getByRole("combobox"), "distance");

    await user.click(screen.getByRole("button", { name: /heathrow airport/i }));
    expect(screen.getByTestId("side-panel")).toHaveTextContent("Heathrow Airport");

    await user.click(screen.getByRole("button", { name: "select-airport" }));
    await user.click(screen.getByRole("button", { name: /5,540 km/i }));
    expect(screen.getByTestId("side-panel")).toHaveTextContent("Route detail");

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByText("Pick a connection to inspect the network.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "clear-selection" }));
    expect(screen.getByText("Pick a connection to inspect the network.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "select-route" }));
    expect(screen.getByTestId("side-panel")).toHaveTextContent("Route detail");
  });

  it("registers the E2E test api when enabled", async () => {
    process.env.NEXT_PUBLIC_E2E = "1";
    const view = render(<GlobeShell />);

    await waitFor(() => {
      expect(window.__GLOBAL_PLANNER_TEST_API__).toBeDefined();
    });

    await waitFor(() => {
      expect(screen.getByTestId("dataset-status")).toHaveTextContent("Loaded 3 airports and 2 routes");
    });

    expect(window.__GLOBAL_PLANNER_TEST_API__).toBeDefined();

    await act(async () => {
      window.__GLOBAL_PLANNER_TEST_API__?.selectRoute("3797__507");
      window.__GLOBAL_PLANNER_TEST_API__?.selectRoute("missing");
      window.__GLOBAL_PLANNER_TEST_API__?.selectAirport("507");
    });

    expect(window.__GLOBAL_PLANNER_TEST_API__?.getState().selection).toBe("?airport=507");
    expect(screen.getByTestId("side-panel")).toHaveTextContent("Heathrow Airport");

    view.unmount();
    expect(window.__GLOBAL_PLANNER_TEST_API__).toBeUndefined();
  });

  it("ignores e2e route selection before the dataset is ready", async () => {
    process.env.NEXT_PUBLIC_E2E = "1";
    vi.mocked(loadDataset).mockImplementationOnce(
      () => new Promise(() => undefined)
    );
    const view = render(<GlobeShell />);

    await waitFor(() => {
      expect(window.__GLOBAL_PLANNER_TEST_API__).toBeDefined();
    });

    await act(async () => {
      window.__GLOBAL_PLANNER_TEST_API__?.selectRoute("3797__507");
    });

    expect(window.__GLOBAL_PLANNER_TEST_API__?.getState().selection).toBe("");
    view.unmount();
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

  it("uses the ICAO code when airport hover lacks an IATA code", () => {
    const dataset = createFixtureDataset();
    dataset.indexes.airportsById.set("3797", {
      ...dataset.airports[0],
      iata: null,
      icao: "KJFK",
    });

    const hoverContent = getHoverContent(
      { kind: "airport", airportId: "3797", x: 10, y: 20 },
      dataset
    );

    expect(hoverContent?.lines[1]).toBe("KJFK");
  });

  it("shows an unavailable code label when hover airport has no codes", () => {
    const dataset = createFixtureDataset();
    dataset.indexes.airportsById.set("3797", {
      ...dataset.airports[0],
      iata: null,
      icao: null,
    });

    const hoverContent = getHoverContent(
      { kind: "airport", airportId: "3797", x: 10, y: 20 },
      dataset
    );

    expect(hoverContent?.lines[1]).toBe("Code unavailable");
  });
});

describe("SidePanel mobile rendering", () => {
  it("switches to the mobile panel class for touch devices", () => {
    const dataset = createFixtureDataset();
    render(
      <SidePanel
        airport={dataset.airports[0]}
        route={null}
        destinationItems={[]}
        panelFilterQuery=""
        panelSortKey="name"
        indexes={dataset.indexes}
        isTouchDevice
        onClose={() => undefined}
        onFilterChange={() => undefined}
        onSortChange={() => undefined}
        onSelectAirport={() => undefined}
        onSelectRoute={() => undefined}
      />
    );

    expect(screen.getByTestId("side-panel").className).toMatch(/mobilePanel/);
  });
});
