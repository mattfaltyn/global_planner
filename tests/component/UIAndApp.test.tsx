import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RootLayout from "../../app/layout";
import HomePage from "../../app/page";
import { GlobeLegend } from "../../components/globe/GlobeLegend";
import { TestGlobeCanvas } from "../../components/globe/TestGlobeCanvas";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { LoadingOverlay } from "../../components/ui/LoadingOverlay";
import { SearchBox } from "../../components/ui/SearchBox";
import { SearchResults } from "../../components/ui/SearchResults";
import { SidePanel } from "../../components/ui/SidePanel";
import { Tooltip } from "../../components/ui/Tooltip";
import { createFixtureDataset, fixtureAirports, fixtureRoutes } from "../fixtures/dataset";

vi.mock("next/font/local", () => ({
  default: () => ({ variable: "mock-font" }),
}));

vi.mock("../../components/globe/GlobeShell", () => ({
  GlobeShell: () => <div data-testid="globe-shell-page-mock" />,
}));

describe("app shells and UI components", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the root layout and page entrypoint", () => {
    const markup = renderToStaticMarkup(
      <RootLayout>
        <div>child</div>
      </RootLayout>
    );

    render(<HomePage />);

    expect(markup).toContain("mock-font");
    expect(markup).toContain("child");
    expect(screen.getByTestId("globe-shell-page-mock")).toBeInTheDocument();
  });

  it("renders static globe and panel helper components", async () => {
    const user = userEvent.setup();
    const dataset = createFixtureDataset();
    const onRetry = vi.fn();
    const onClearSelection = vi.fn();
    const onClose = vi.fn();
    const onFilterChange = vi.fn();
    const onSortChange = vi.fn();
    const onSelectAirport = vi.fn();
    const onSelectRoute = vi.fn();

    render(
      <>
        <GlobeLegend manifest={dataset.manifest} />
        <TestGlobeCanvas onClearSelection={onClearSelection} />
        <EmptyState />
        <ErrorState message="boom" onRetry={onRetry} />
        <LoadingOverlay />
        <Tooltip x={10} y={20} title="Title" lines={["A", "B"]} />
        <SidePanel
          airport={dataset.airports[0]}
          route={null}
          destinationItems={[
            {
              airport: dataset.airports[1],
              route: dataset.routes[0],
              distanceKm: dataset.routes[0].distanceKm,
            },
          ]}
          panelFilterQuery=""
          panelSortKey="name"
          indexes={dataset.indexes}
          isTouchDevice={false}
          onClose={onClose}
          onFilterChange={onFilterChange}
          onSortChange={onSortChange}
          onSelectAirport={onSelectAirport}
          onSelectRoute={onSelectRoute}
        />
      </>
    );

    await user.click(screen.getByRole("button", { name: "E2E globe fallback" }));
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await user.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.change(screen.getByPlaceholderText("Filter destinations"), {
      target: { value: "lon" },
    });
    await user.selectOptions(screen.getByRole("combobox"), "distance");
    await user.click(screen.getByRole("button", { name: /heathrow airport/i }));
    await user.click(screen.getByRole("button", { name: /5,540 km/i }));

    expect(screen.getByText("Major-airport direct route globe")).toBeInTheDocument();
    expect(screen.getByText("Pick a connection to inspect the network.")).toBeInTheDocument();
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(onClearSelection).toHaveBeenCalled();
    expect(onRetry).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    expect(onFilterChange).toHaveBeenCalledWith("lon");
    expect(onSortChange).toHaveBeenCalledWith("distance");
    expect(onSelectAirport).toHaveBeenCalledWith("507");
    expect(onSelectRoute).toHaveBeenCalledWith("3797__507", "3797");
  });

  it("renders route mode side panel actions", async () => {
    const user = userEvent.setup();
    const dataset = createFixtureDataset();
    const onSelectAirport = vi.fn();

    render(
      <SidePanel
        airport={dataset.airports[0]}
        route={dataset.routes[0]}
        destinationItems={[]}
        panelFilterQuery=""
        panelSortKey="name"
        indexes={dataset.indexes}
        isTouchDevice
        onClose={() => undefined}
        onFilterChange={() => undefined}
        onSortChange={() => undefined}
        onSelectAirport={onSelectAirport}
        onSelectRoute={() => undefined}
      />
    );

    await user.click(screen.getByRole("button", { name: /jump to jfk/i }));
    await user.click(screen.getByRole("button", { name: /jump to lhr/i }));

    expect(screen.getByTestId("side-panel")).toHaveTextContent("Directionality");
    expect(onSelectAirport).toHaveBeenNthCalledWith(1, "3797");
    expect(onSelectAirport).toHaveBeenNthCalledWith(2, "507");
  });

  it("covers SearchResults code fallback and empty SidePanel content", () => {
    render(
      <>
        <SearchResults
          results={[
            {
              ...fixtureAirports[0],
              iata: null,
              icao: null,
            },
          ]}
          activeIndex={0}
          onSelect={() => undefined}
        />
        <SidePanel
          airport={null}
          route={null}
          destinationItems={[]}
          panelFilterQuery=""
          panelSortKey="name"
          indexes={createFixtureDataset().indexes}
          isTouchDevice={false}
          onClose={() => undefined}
          onFilterChange={() => undefined}
          onSortChange={() => undefined}
          onSelectAirport={() => undefined}
          onSelectRoute={() => undefined}
        />
        <SidePanel
          airport={{
            ...fixtureAirports[0],
            iata: null,
            icao: null,
            tzName: null,
          }}
          route={null}
          destinationItems={[]}
          panelFilterQuery=""
          panelSortKey="name"
          indexes={createFixtureDataset().indexes}
          isTouchDevice={false}
          onClose={() => undefined}
          onFilterChange={() => undefined}
          onSortChange={() => undefined}
          onSelectAirport={() => undefined}
          onSelectRoute={() => undefined}
        />
        <SidePanel
          airport={createFixtureDataset().airports[0]}
          route={{
            ...fixtureRoutes[0],
          }}
          destinationItems={[]}
          panelFilterQuery=""
          panelSortKey="name"
          indexes={{
            ...createFixtureDataset().indexes,
            airportsById: new Map([
              [
                "3797",
                {
                  ...fixtureAirports[0],
                  iata: null,
                },
              ],
              [
                "507",
                {
                  ...fixtureAirports[1],
                  iata: null,
                },
              ],
            ]),
          }}
          isTouchDevice={false}
          onClose={() => undefined}
          onFilterChange={() => undefined}
          onSortChange={() => undefined}
          onSelectAirport={() => undefined}
          onSelectRoute={() => undefined}
        />
      </>
    );

    expect(screen.getByText("N/A")).toBeInTheDocument();
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("side-panel")).toHaveLength(3);
    expect(screen.getAllByText(/Jump to/)[0]).toHaveTextContent("Jump to John F Kennedy International Airport");
  });

  it("handles search box keyboard navigation and result selection", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    const onSelect = vi.fn();

    const { rerender } = render(
      <SearchBox
        query="J"
        results={fixtureAirports.map((airport) => ({ ...airport }))}
        onQueryChange={onQueryChange}
        onSelect={onSelect}
      />
    );

    const input = screen.getByLabelText("Search airports");
    await user.type(input, "F");
    await user.keyboard("{ArrowDown}{ArrowUp}{Enter}{Escape}");

    expect(onQueryChange).toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "3797" }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    rerender(
      <SearchBox
        query=""
        results={[]}
        onQueryChange={onQueryChange}
        onSelect={onSelect}
      />
    );

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("renders search results active and inactive states", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <SearchResults
        results={fixtureAirports.map((airport) => ({ ...airport }))}
        activeIndex={1}
        onSelect={onSelect}
      />
    );

    const buttons = screen.getAllByRole("button");
    await user.pointer({ keys: "[MouseLeft>]", target: buttons[0] });

    expect(buttons[1].className).toMatch(/active/);
    expect(buttons[0].className).toMatch(/item/);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "3797" }));
  });
});
