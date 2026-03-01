import type { ItineraryLeg, PlaybackState } from "../data/types";
import {
  buildTimelineSegments,
  getTimelineFrameFromTripProgress,
  getTripProgressForLegEnd,
  getTripProgressForLegStart,
} from "./timeline";

function createPlaybackFrame(
  tripProgress: number,
  legs: ItineraryLeg[],
  speed: PlaybackState["speed"],
  status: PlaybackState["status"]
): PlaybackState {
  const frame = getTimelineFrameFromTripProgress(
    buildTimelineSegments(legs),
    tripProgress,
    speed
  );

  return {
    status,
    speed,
    tripProgress: frame.tripProgress,
    activeLegIndex: frame.activeLegIndex,
    activeLegProgress: frame.activeLegProgress,
    phase: frame.phase,
  };
}

export function createInitialPlaybackState(): PlaybackState {
  return {
    status: "idle",
    speed: 1,
    tripProgress: 0,
    activeLegIndex: 0,
    activeLegProgress: 0,
    phase: "travel",
  };
}

export function syncPlaybackState(
  playback: PlaybackState,
  legs: ItineraryLeg[],
  tripProgress = playback.tripProgress,
  status = playback.status
) {
  return createPlaybackFrame(tripProgress, legs, playback.speed, status);
}

export function advancePlaybackState(
  playback: PlaybackState,
  legs: ItineraryLeg[],
  deltaMs: number
): PlaybackState {
  if (playback.status !== "playing" || legs.length === 0) {
    return playback;
  }

  const segments = buildTimelineSegments(legs);
  const totalDurationMs = segments.reduce(
    (sum, segment) => sum + segment.durationMs / playback.speed,
    0
  );

  if (totalDurationMs === 0) {
    return {
      ...playback,
      status: "paused",
    };
  }

  const nextTripProgress = Math.min(
    1,
    playback.tripProgress + deltaMs / totalDurationMs
  );
  const nextPlayback = syncPlaybackState(
    playback,
    legs,
    nextTripProgress,
    nextTripProgress >= 1 ? "paused" : "playing"
  );

  return nextPlayback;
}

export function jumpPlaybackToLegStart(
  playback: PlaybackState,
  legs: ItineraryLeg[],
  legIndex: number,
  status: PlaybackState["status"] = "paused"
) {
  const boundedLegIndex = Math.max(0, Math.min(legIndex, Math.max(legs.length - 1, 0)));
  const tripProgress = getTripProgressForLegStart(
    buildTimelineSegments(legs),
    boundedLegIndex,
    playback.speed
  );

  return syncPlaybackState(playback, legs, tripProgress, status);
}

export function jumpPlaybackToLegEnd(
  playback: PlaybackState,
  legs: ItineraryLeg[],
  legIndex: number,
  status: PlaybackState["status"] = "paused"
) {
  const boundedLegIndex = Math.max(0, Math.min(legIndex, Math.max(legs.length - 1, 0)));
  const tripProgress = getTripProgressForLegEnd(
    buildTimelineSegments(legs),
    boundedLegIndex,
    playback.speed
  );

  return syncPlaybackState(playback, legs, tripProgress, status);
}
