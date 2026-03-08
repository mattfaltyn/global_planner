import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlaybackControls } from "../../components/ui/PlaybackControls";
import { createResolvedFixtureItinerary } from "../fixtures/dataset";

describe("PlaybackControls", () => {
  it("renders and wires playback controls", () => {
    const { stops, legs } = createResolvedFixtureItinerary();
    const onPlay = vi.fn();
    const onPause = vi.fn();
    const onReset = vi.fn();
    const onStepPrev = vi.fn();
    const onStepNext = vi.fn();
    const onSpeedChange = vi.fn();
    const onProgressChange = vi.fn();

    const { rerender } = render(
      <PlaybackControls
        stops={stops}
        legs={legs}
        legCount={legs.length}
        playback={{
          status: "paused",
          speed: 1,
          tripProgress: 0.4,
          activeLegIndex: 2,
          activeLegProgress: 0.3,
          phase: "travel",
        }}
        onPlay={onPlay}
        onPause={onPause}
        onReset={onReset}
        onStepPrev={onStepPrev}
        onStepNext={onStepNext}
        onSpeedChange={onSpeedChange}
        onProgressChange={onProgressChange}
      />
    );

    expect(screen.getByText(`Leg 3 of ${legs.length}`)).toBeInTheDocument();
    expect(screen.getByText(/Progress: \d+%/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(screen.getByLabelText("Playback speed"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText(/Progress:/), {
      target: { value: "50" },
    });

    expect(onPlay).toHaveBeenCalled();
    expect(onReset).toHaveBeenCalled();
    expect(onStepPrev).toHaveBeenCalled();
    expect(onStepNext).toHaveBeenCalled();
    expect(onSpeedChange).toHaveBeenCalledWith(2);
    expect(onProgressChange).toHaveBeenCalled();

    rerender(
      <PlaybackControls
        stops={stops}
        legs={legs}
        legCount={0}
        playback={{
          status: "playing",
          speed: 1,
          tripProgress: 0,
          activeLegIndex: 0,
          activeLegProgress: 0,
          phase: "travel",
        }}
        onPlay={onPlay}
        onPause={onPause}
        onReset={onReset}
        onStepPrev={onStepPrev}
        onStepNext={onStepNext}
        onSpeedChange={onSpeedChange}
        onProgressChange={onProgressChange}
      />
    );

    expect(screen.getByText("Leg 1 of 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(onPause).toHaveBeenCalled();
  });
});
