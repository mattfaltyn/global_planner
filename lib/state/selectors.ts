import type {
  ItineraryLeg,
  ItinerarySelection,
  ItineraryStop,
  PlaybackState,
  RenderLegState,
} from "../data/types";
import {
  getOverviewCameraIntent,
  type GlobePointOfView,
} from "../globe/camera";
import {
  parseItinerarySelectionFromQuery,
  serializeItinerarySelectionToQuery,
} from "../itinerary/urls";
import {
  buildTimelineSegments,
  getTimelineFrameFromTripProgress,
  getTotalTimelineDurationMs,
  getTripProgressForLegEnd,
  getTripProgressForLegStart,
  type TimelineFrame,
  type TimelineSegment,
} from "../itinerary/timeline";

export {
  parseItinerarySelectionFromQuery,
  serializeItinerarySelectionToQuery,
};

export function getSelectedStop(
  selection: ItinerarySelection,
  stops: ItineraryStop[]
) {
  if (!selection || selection.kind !== "stop") {
    return null;
  }

  return stops.find((stop) => stop.id === selection.stopId) ?? null;
}

export function getSelectedLeg(
  selection: ItinerarySelection,
  legs: ItineraryLeg[]
) {
  if (!selection || selection.kind !== "leg") {
    return null;
  }

  return legs.find((leg) => leg.id === selection.legId) ?? null;
}

export function getLegByIndex(legs: ItineraryLeg[], activeLegIndex: number) {
  return legs[activeLegIndex] ?? null;
}

export function getTravelModeCounts(legs: ItineraryLeg[]) {
  return legs.reduce(
    (counts, leg) => {
      counts[leg.mode] += 1;
      return counts;
    },
    { air: 0, ground: 0 }
  );
}

export function getTripDateSpan(stops: ItineraryStop[]) {
  const departureDates = stops
    .map((stop) => stop.departureDate)
    .filter((value): value is string => Boolean(value));

  if (departureDates.length === 0) {
    return null;
  }

  return {
    start: departureDates[0],
    end: departureDates[departureDates.length - 1],
  };
}

function toUtcDateMs(value: string) {
  return new Date(`${value}T00:00:00Z`).getTime();
}

function formatPlaybackDate(timeMs: number) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timeMs));
}

function getStopBoundaryDate(
  stop: ItineraryStop | null,
  boundary: "arrival" | "departure"
) {
  if (!stop) {
    return null;
  }

  return boundary === "arrival"
    ? stop.arrivalDate ?? stop.departureDate
    : stop.departureDate ?? stop.arrivalDate;
}

function getSegmentProgress(
  segments: TimelineSegment[],
  tripProgress: number,
  speed: PlaybackState["speed"]
) {
  const clampedProgress = Math.max(0, Math.min(1, tripProgress));
  const totalDurationMs = getTotalTimelineDurationMs(segments, speed);
  const targetElapsedMs = clampedProgress * totalDurationMs;
  let traversedMs = 0;

  for (const segment of segments) {
    const segmentDurationMs = segment.durationMs / speed;
    const segmentEndMs = traversedMs + segmentDurationMs;

    if (targetElapsedMs <= segmentEndMs || segment === segments[segments.length - 1]) {
      return {
        segment,
        progress:
          segmentDurationMs === 0
            ? 1
            : Math.max(0, Math.min(1, (targetElapsedMs - traversedMs) / segmentDurationMs)),
      };
    }

    traversedMs = segmentEndMs;
  }

  return {
    segment: segments[segments.length - 1],
    progress: 1,
  };
}

export function getPlaybackDaySummary(
  stops: ItineraryStop[],
  legs: ItineraryLeg[],
  playback: PlaybackState
) {
  const span = getTripDateSpan(stops);
  if (!span) {
    return null;
  }

  const startMs = toUtcDateMs(span.start);
  const endMs = toUtcDateMs(span.end);
  const totalDays = Math.max(1, Math.floor((endMs - startMs) / 86_400_000) + 1);
  const segments = buildTimelineSegments(legs);
  const { segment, progress } = getSegmentProgress(
    segments,
    playback.tripProgress,
    playback.speed
  );
  const activeLeg = legs[segment?.legIndex ?? playback.activeLegIndex] ?? null;
  const fromStop = activeLeg
    ? stops.find((stop) => stop.id === activeLeg.fromStopId) ?? null
    : null;
  const toStop = activeLeg
    ? stops.find((stop) => stop.id === activeLeg.toStopId) ?? null
    : null;

  const segmentStart = segment?.kind === "dwell"
    ? getStopBoundaryDate(toStop, "arrival")
    : getStopBoundaryDate(fromStop, "departure");
  const segmentEnd = segment?.kind === "dwell"
    ? getStopBoundaryDate(toStop, "departure")
    : getStopBoundaryDate(toStop, "arrival");
  const segmentStartMs = toUtcDateMs(segmentStart ?? span.start);
  const segmentEndMs = toUtcDateMs(segmentEnd ?? segmentStart ?? span.end);
  const currentTimeMs =
    segmentEndMs <= segmentStartMs
      ? segmentStartMs
      : segmentStartMs +
        Math.floor((segmentEndMs - segmentStartMs) * Math.max(0, Math.min(1, progress)));
  const currentDay = Math.min(
    totalDays,
    Math.max(1, Math.floor((currentTimeMs - startMs) / 86_400_000) + 1)
  );

  return {
    currentDay,
    totalDays,
    currentDateLabel: formatPlaybackDate(currentTimeMs),
    rangeLabel: `${formatPlaybackDate(startMs)} -> ${formatPlaybackDate(endMs)}`,
  };
}

export function getTimelineSegments(legs: ItineraryLeg[]) {
  return buildTimelineSegments(legs);
}

export function getTimelineFrame(
  playback: PlaybackState,
  legs: ItineraryLeg[]
): TimelineFrame {
  return getTimelineFrameFromTripProgress(
    buildTimelineSegments(legs),
    playback.tripProgress,
    playback.speed
  );
}

export function getTripProgressPercent(playback: PlaybackState) {
  return Math.round(playback.tripProgress * 100);
}

export function getPlaybackProgressPercent(playback: PlaybackState) {
  return getTripProgressPercent(playback);
}

export function getActiveLegLabel(
  stops: ItineraryStop[],
  legs: ItineraryLeg[],
  playback: PlaybackState
) {
  const activeLeg = getLegByIndex(legs, playback.activeLegIndex);
  if (!activeLeg) {
    return "Trip not started";
  }

  const fromStop = stops.find((stop) => stop.id === activeLeg.fromStopId);
  const toStop = stops.find((stop) => stop.id === activeLeg.toStopId);

  return `${fromStop?.label ?? activeLeg.fromStopId} to ${
    toStop?.label ?? activeLeg.toStopId
  }`;
}

export function getCurrentStopPair(
  stops: ItineraryStop[],
  playback: PlaybackState,
  legs: ItineraryLeg[]
) {
  const activeLeg = getLegByIndex(legs, playback.activeLegIndex);
  if (!activeLeg) {
    return { currentStop: stops[0] ?? null, nextStop: stops[1] ?? null };
  }

  return {
    currentStop:
      stops.find((stop) => stop.id === activeLeg.fromStopId) ?? null,
    nextStop: stops.find((stop) => stop.id === activeLeg.toStopId) ?? null,
  };
}

function getLegIndex(legs: ItineraryLeg[], legId: string) {
  return legs.findIndex((leg) => leg.id === legId);
}

export function getVisibleLegRenderState(
  leg: ItineraryLeg,
  legs: ItineraryLeg[],
  playback: PlaybackState,
  selection: ItinerarySelection
): RenderLegState {
  if (selection?.kind === "leg" && selection.legId === leg.id) {
    return "selected";
  }

  const activeLeg = getLegByIndex(legs, playback.activeLegIndex);
  if (activeLeg?.id === leg.id) {
    return "active";
  }

  if (selection?.kind === "stop") {
    const selectedStopIndex = stopsIndexFromLegsSelection(legs, selection.stopId);
    const legIndex = getLegIndex(legs, leg.id);
    if (selectedStopIndex >= 0 && Math.abs(legIndex - selectedStopIndex) <= 1) {
      return "context";
    }
  }

  const legIndex = getLegIndex(legs, leg.id);
  if (playback.status === "idle") {
    return "future";
  }

  return legIndex < playback.activeLegIndex ? "past" : "future";
}

function stopsIndexFromLegsSelection(legs: ItineraryLeg[], stopId: string) {
  const incomingIndex = legs.findIndex((leg) => leg.toStopId === stopId);
  if (incomingIndex >= 0) {
    return incomingIndex;
  }

  return legs.findIndex((leg) => leg.fromStopId === stopId);
}

export function getItineraryFitPointOfView(
  stops: ItineraryStop[]
): GlobePointOfView {
  return getOverviewCameraIntent(stops).target;
}

export function getTimelineNavigationProgress(
  segments: TimelineSegment[],
  playback: PlaybackState,
  direction: "prev" | "next"
) {
  if (segments.length === 0) {
    return 0;
  }

  if (direction === "prev") {
    const previousLegIndex =
      playback.phase === "dwell" && playback.activeLegProgress === 1
        ? playback.activeLegIndex
        : Math.max(0, playback.activeLegIndex - 1);

    return getTripProgressForLegStart(
      segments,
      previousLegIndex,
      playback.speed
    );
  }

  const nextLegIndex = Math.min(
    segments[segments.length - 1].legIndex,
    playback.activeLegIndex + 1
  );

  return getTripProgressForLegStart(segments, nextLegIndex, playback.speed);
}

export function getLegStartProgress(
  segments: TimelineSegment[],
  playback: PlaybackState,
  legId: string,
  legs: ItineraryLeg[]
) {
  const legIndex = getLegIndex(legs, legId);
  if (legIndex < 0) {
    return playback.tripProgress;
  }

  return getTripProgressForLegStart(segments, legIndex, playback.speed);
}

export function getLegEndProgress(
  segments: TimelineSegment[],
  playback: PlaybackState,
  legId: string,
  legs: ItineraryLeg[]
) {
  const legIndex = getLegIndex(legs, legId);
  if (legIndex < 0) {
    return playback.tripProgress;
  }

  return getTripProgressForLegEnd(segments, legIndex, playback.speed);
}
