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

vi.mock("next/dynamic", () => ({
  default: () => function MockDynamicComponent() {
    return <div data-testid="globe-canvas-mock" />;
  },
}));

vi.mock("../../lib/data/loadDataset", () => ({
  loadDataset: vi.fn(),
}));

import { loadDataset } from "../../lib/data/loadDataset";
import { GlobeShell } from "../../components/globe/GlobeShell";
import { SidePanel } from "../../components/ui/SidePanel";

describe("GlobeShell", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    vi.mocked(loadDataset).mockResolvedValue(createFixtureDataset());
  });

  it("shows a loading state and then renders the dataset", async () => {
    render(<GlobeShell />);

    expect(screen.getByTestId("loading-overlay")).toBeInTheDocument();
    await waitForElementToBeRemoved(() => screen.getByTestId("loading-overlay"));

    expect(screen.getByTestId("dataset-status")).toHaveTextContent("Loaded 3 airports and 2 routes");
    expect(screen.getByTestId("globe-canvas-mock")).toBeInTheDocument();
  });

  it("searches and selects an airport, updating the URL", async () => {
    const user = userEvent.setup();
    render(<GlobeShell />);

    await waitForElementToBeRemoved(() => screen.getByTestId("loading-overlay"));
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

    await waitForElementToBeRemoved(() => screen.getByTestId("loading-overlay"));

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
      window.history.pushState({}, "", "/?airport=507");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("side-panel")).toHaveTextContent("Heathrow Airport");
    });
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
