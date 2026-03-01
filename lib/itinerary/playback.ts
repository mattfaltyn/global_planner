import type { ItineraryLeg, PlaybackSpeed, PlaybackState } from "../data/types";

const AIR_DURATION_MS = 2200;
const GROUND_DURATION_MS = 3200;
const LEG_DWELL_MS = 700;

export function getPlaybackLegDurationMs(leg: ItineraryLeg, speed: PlaybackSpeed) {
  const baseDuration = leg.mode === "air" ? AIR_DURATION_MS : GROUND_DURATION_MS;
  return baseDuration / speed;
}

export function createInitialPlaybackState(): PlaybackState {
  return {
    status: "idle",
    activeLegIndex: 0,
    progress: 0,
    speed: 1,
    dwellRemainingMs: 0,
  };
}

export function advancePlaybackState(
  playback: PlaybackState,
  legs: ItineraryLeg[],
  deltaMs: number
): PlaybackState {
  if (playback.status !== "playing" || legs.length === 0) {
    return playback;
  }

  const activeLeg = legs[playback.activeLegIndex];
  if (!activeLeg) {
    return {
      ...playback,
      status: "paused",
      progress: 1,
      dwellRemainingMs: 0,
    };
  }

  if (playback.dwellRemainingMs > 0) {
    const remaining = playback.dwellRemainingMs - deltaMs;
    if (remaining > 0) {
      return {
        ...playback,
        dwellRemainingMs: remaining,
      };
    }

    return {
      ...playback,
      dwellRemainingMs: 0,
    };
  }

  const durationMs = getPlaybackLegDurationMs(activeLeg, playback.speed);
  const nextProgress = playback.progress + deltaMs / durationMs;

  if (nextProgress < 1) {
    return {
      ...playback,
      progress: nextProgress,
    };
  }

  if (playback.activeLegIndex >= legs.length - 1) {
    return {
      ...playback,
      status: "paused",
      progress: 1,
      dwellRemainingMs: 0,
    };
  }

  return {
    ...playback,
    activeLegIndex: playback.activeLegIndex + 1,
    progress: 0,
    dwellRemainingMs: LEG_DWELL_MS,
  };
}
