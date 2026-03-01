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
import { ItineraryPanel } from "../../components/ui/ItineraryPanel";
import { LoadingOverlay } from "../../components/ui/LoadingOverlay";
import { SearchBox } from "../../components/ui/SearchBox";
import { SearchResults } from "../../components/ui/SearchResults";
import { Tooltip } from "../../components/ui/Tooltip";
import { createResolvedFixtureItinerary, fixtureAirports } from "../fixtures/dataset";

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

  it("renders static globe and itinerary helper components", async () => {
    const user = userEvent.setup();
    const { stops, legs } = createResolvedFixtureItinerary();
    const onRetry = vi.fn();
    const onSelectStop = vi.fn();
    const onSelectLeg = vi.fn();
    const onClearSelection = vi.fn();

    render(
      <>
        <GlobeLegend stops={stops} legs={legs} />
        <TestGlobeCanvas
          stops={stops}
          legs={legs}
          selection={null}
          playback={{ status: "idle", activeLegIndex: 0, progress: 0 }}
          onSelectStop={onSelectStop}
          onSelectLeg={onSelectLeg}
          onClearSelection={onClearSelection}
        />
        <EmptyState />
        <ErrorState message="boom" onRetry={onRetry} />
        <LoadingOverlay />
        <Tooltip x={10} y={20} title="Title" lines={["A", "B"]} />
      </>
    );

    await user.click(screen.getByRole("button", { name: "Vancouver" }));
    await user.click(screen.getByRole("button", { name: "seed-stop-0__seed-stop-1" }));
    await user.click(screen.getByRole("button", { name: "Clear selection" }));
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(screen.getByText("Travel itinerary")).toBeInTheDocument();
    expect(screen.getByText("Build a route and press play.")).toBeInTheDocument();
    expect(screen.getByText("Preparing the itinerary globe")).toBeInTheDocument();
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByTestId("test-globe-summary")).toHaveTextContent("9 stops");
    expect(onSelectStop).toHaveBeenCalledWith("seed-stop-0");
    expect(onSelectLeg).toHaveBeenCalledWith("seed-stop-0__seed-stop-1");
    expect(onClearSelection).toHaveBeenCalled();
    expect(onRetry).toHaveBeenCalled();
  });

  it("renders the test globe selection summary when a selection exists", () => {
    const { stops, legs } = createResolvedFixtureItinerary();

    render(
      <TestGlobeCanvas
        stops={stops}
        legs={legs}
        selection={{ kind: "leg", legId: legs[0].id }}
        playback={{ status: "paused", activeLegIndex: 0, progress: 0.25 }}
        onSelectStop={() => undefined}
        onSelectLeg={() => undefined}
        onClearSelection={() => undefined}
      />
    );

    expect(screen.getByTestId("test-globe-selection")).toHaveTextContent(
      JSON.stringify({ kind: "leg", legId: legs[0].id })
    );
  });

  it("renders and interacts with the itinerary panel", async () => {
    const user = userEvent.setup();
    const { stops, legs } = createResolvedFixtureItinerary();
    const onClose = vi.fn();
    const onSelectStop = vi.fn();
    const onMoveStopUp = vi.fn();
    const onMoveStopDown = vi.fn();
    const onRemoveStop = vi.fn();
    const onInsertAfter = vi.fn();
    const onUpdateStop = vi.fn();
    const onReplaceAnchor = vi.fn();
    const onSetLegMode = vi.fn();
    const onPlay = vi.fn();
    const onPause = vi.fn();
    const onReset = vi.fn();
    const onStepPrev = vi.fn();
    const onStepNext = vi.fn();
    const onSpeedChange = vi.fn();
    const onProgressChange = vi.fn();
    const onPlayLeg = vi.fn();

    render(
      <ItineraryPanel
        stops={stops}
        legs={legs}
        selection={{ kind: "leg", legId: legs[4].id }}
        playback={{
          status: "playing",
          activeLegIndex: 4,
          progress: 0.5,
          speed: 1,
          dwellRemainingMs: 0,
        }}
        isTouchDevice
        onClose={onClose}
        onSelectStop={onSelectStop}
        onMoveStopUp={onMoveStopUp}
        onMoveStopDown={onMoveStopDown}
        onRemoveStop={onRemoveStop}
        onInsertAfter={onInsertAfter}
        onUpdateStop={onUpdateStop}
        onReplaceAnchor={onReplaceAnchor}
        onSetLegMode={onSetLegMode}
        onPlay={onPlay}
        onPause={onPause}
        onReset={onReset}
        onStepPrev={onStepPrev}
        onStepNext={onStepNext}
        onSpeedChange={onSpeedChange}
        onProgressChange={onProgressChange}
        onPlayLeg={onPlayLeg}
      />
    );

    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Pause" }));
    await user.click(screen.getByRole("button", { name: "Reset" }));
    await user.click(screen.getByRole("button", { name: "Previous" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.selectOptions(screen.getByLabelText("Playback speed"), "2");
    fireEvent.change(screen.getByLabelText(/Progress:/), { target: { value: "25" } });
    await user.click(screen.getByRole("button", { name: /1. Vancouver/i }));
    await user.click(screen.getAllByRole("button", { name: "Up" })[0]);
    await user.click(screen.getAllByRole("button", { name: "Down" })[0]);
    await user.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    await user.click(screen.getAllByRole("button", { name: "Insert after" })[0]);
    await user.click(screen.getByRole("button", { name: "Air" }));
    await user.click(screen.getByRole("button", { name: "Ground" }));
    await user.click(screen.getByRole("button", { name: "Play this leg" }));

    expect(screen.getByTestId("itinerary-panel").className).toMatch(/mobilePanel/);
    expect(screen.getByText("Summary")).toBeInTheDocument();
    expect(screen.getByText(/Feb 20, 2026 to Apr 10, 2026/)).toBeInTheDocument();
    expect(screen.getByText(/Active leg: Lisbon to Barcelona/)).toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
    expect(onPause).toHaveBeenCalled();
    expect(onReset).toHaveBeenCalled();
    expect(onStepPrev).toHaveBeenCalled();
    expect(onStepNext).toHaveBeenCalled();
    expect(onSpeedChange).toHaveBeenCalledWith(2);
    expect(onProgressChange).toHaveBeenCalledWith(0.25);
    expect(onSelectStop).toHaveBeenCalledWith("seed-stop-0");
    expect(onMoveStopUp).toHaveBeenCalledWith("seed-stop-0");
    expect(onMoveStopDown).toHaveBeenCalledWith("seed-stop-0");
    expect(onRemoveStop).toHaveBeenCalledWith("seed-stop-0");
    expect(onInsertAfter).toHaveBeenCalledWith(0, "seed-stop-0");
    expect(onSetLegMode).toHaveBeenNthCalledWith(1, legs[4].id, "air");
    expect(onSetLegMode).toHaveBeenNthCalledWith(2, legs[4].id, "ground");
    expect(onPlayLeg).toHaveBeenCalledWith(legs[4].id);
  });

  it("renders the stop editor and playback idle state", async () => {
    const user = userEvent.setup();
    const { stops, legs } = createResolvedFixtureItinerary();
    const unresolvedStop = {
      ...stops[1],
      unresolved: true,
      anchorAirportId: null,
    };
    const onUpdateStop = vi.fn();
    const onReplaceAnchor = vi.fn();
    const onPlay = vi.fn();

    render(
      <ItineraryPanel
        stops={[stops[0], unresolvedStop]}
        legs={legs.slice(0, 1)}
        selection={{ kind: "stop", stopId: unresolvedStop.id }}
        playback={{
          status: "idle",
          activeLegIndex: 0,
          progress: 0,
          speed: 1,
          dwellRemainingMs: 0,
        }}
        isTouchDevice={false}
        onClose={() => undefined}
        onSelectStop={() => undefined}
        onMoveStopUp={() => undefined}
        onMoveStopDown={() => undefined}
        onRemoveStop={() => undefined}
        onInsertAfter={() => undefined}
        onUpdateStop={onUpdateStop}
        onReplaceAnchor={onReplaceAnchor}
        onSetLegMode={() => undefined}
        onPlay={onPlay}
        onPause={() => undefined}
        onReset={() => undefined}
        onStepPrev={() => undefined}
        onStepNext={() => undefined}
        onSpeedChange={() => undefined}
        onProgressChange={() => undefined}
        onPlayLeg={() => undefined}
      />
    );

    await user.click(screen.getByRole("button", { name: "Play" }));
    fireEvent.change(screen.getByLabelText("Label"), { target: { value: "Porto Base" } });
    fireEvent.change(screen.getByLabelText("Arrival date"), {
      target: { value: "2026-02-22" },
    });
    fireEvent.change(screen.getByLabelText("Departure date"), {
      target: { value: "2026-03-03" },
    });
    fireEvent.change(screen.getByLabelText("Arrival date"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Departure date"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "Walkable city" },
    });
    await user.click(screen.getByRole("button", { name: "Replace anchor with search" }));

    expect(screen.getByText("This stop is unresolved. Use search to replace its anchor airport.")).toBeInTheDocument();
    expect(screen.getByText("Unresolved")).toBeInTheDocument();
    expect(onPlay).toHaveBeenCalled();
    expect(onUpdateStop).toHaveBeenNthCalledWith(1, unresolvedStop.id, { label: "Porto Base" });
    expect(onUpdateStop).toHaveBeenNthCalledWith(2, unresolvedStop.id, {
      arrivalDate: "2026-02-22",
    });
    expect(onUpdateStop).toHaveBeenNthCalledWith(3, unresolvedStop.id, {
      departureDate: "2026-03-03",
    });
    expect(onUpdateStop).toHaveBeenNthCalledWith(4, unresolvedStop.id, {
      arrivalDate: null,
    });
    expect(onUpdateStop).toHaveBeenNthCalledWith(5, unresolvedStop.id, {
      departureDate: null,
    });
    expect(onUpdateStop).toHaveBeenNthCalledWith(6, unresolvedStop.id, {
      notes: "Walkable city",
    });
    expect(onReplaceAnchor).toHaveBeenCalledWith(unresolvedStop.id);
  });

  it("renders fallback labels and unknown leg distance when stop data is missing", () => {
    const missingLeg = {
      id: "missing-from__missing-to",
      fromStopId: "missing-from",
      toStopId: "missing-to",
      mode: "ground" as const,
      distanceKm: null,
      pathPoints: [],
    };

    render(
      <ItineraryPanel
        stops={[]}
        legs={[missingLeg]}
        selection={{ kind: "leg", legId: missingLeg.id }}
        playback={{
          status: "paused",
          activeLegIndex: 0,
          progress: 0.5,
          speed: 1,
          dwellRemainingMs: 0,
        }}
        isTouchDevice={false}
        onClose={() => undefined}
        onSelectStop={() => undefined}
        onMoveStopUp={() => undefined}
        onMoveStopDown={() => undefined}
        onRemoveStop={() => undefined}
        onInsertAfter={() => undefined}
        onUpdateStop={() => undefined}
        onReplaceAnchor={() => undefined}
        onSetLegMode={() => undefined}
        onPlay={() => undefined}
        onPause={() => undefined}
        onReset={() => undefined}
        onStepPrev={() => undefined}
        onStepNext={() => undefined}
        onSpeedChange={() => undefined}
        onProgressChange={() => undefined}
        onPlayLeg={() => undefined}
      />
    );

    expect(screen.getByText("Dates unavailable")).toBeInTheDocument();
    expect(screen.getByText(/Active leg: missing-from to missing-to/)).toBeInTheDocument();
    expect(screen.getAllByText(/missing-from to missing-to/)).toHaveLength(2);
    expect(screen.getByText("Unknown distance")).toBeInTheDocument();
  });

  it("handles search box keyboard navigation and result selection", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    const onSelect = vi.fn();

    const { rerender } = render(
      <SearchBox
        query="V"
        results={fixtureAirports.map((airport) => ({ ...airport }))}
        onQueryChange={onQueryChange}
        onSelect={onSelect}
      />
    );

    const input = screen.getByLabelText("Search airports");
    await user.type(input, "A");
    await user.keyboard("{ArrowDown}{ArrowUp}{Enter}{Escape}");

    expect(onQueryChange).toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "1" }));
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

  it("renders search results active and fallback states", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <SearchResults
        results={[
          ...fixtureAirports.map((airport) => ({ ...airport })),
          {
            ...fixtureAirports[0],
            id: "fallback",
            iata: null,
            icao: null,
          },
        ]}
        activeIndex={1}
        onSelect={onSelect}
      />
    );

    const buttons = screen.getAllByRole("button");
    await user.pointer({ keys: "[MouseLeft>]", target: buttons[0] });

    expect(buttons[1].className).toMatch(/active/);
    expect(buttons[0].className).toMatch(/item/);
    expect(screen.getByText("N/A")).toBeInTheDocument();
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "1" }));
  });
});
