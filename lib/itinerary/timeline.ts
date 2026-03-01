import type {
  ItineraryLeg,
  ItineraryStop,
  PlaybackPhase,
  PlaybackSpeed,
} from "../data/types";

const AIR_TRAVEL_MS = 1800;
const GROUND_TRAVEL_MS = 2400;
const DWELL_MS = 700;

export type TimelineSegment =
  | { kind: "travel"; legIndex: number; durationMs: number }
  | { kind: "dwell"; legIndex: number; durationMs: number };

export type TimelineFrame = {
  tripProgress: number;
  activeLegIndex: number;
  activeLegProgress: number;
  phase: PlaybackPhase;
};

/* c8 ignore next 9 -- defensive fallback for an unreachable post-loop path */
function getFinalTimelineFrame(segments: TimelineSegment[]): TimelineFrame {
  const lastSegment = segments[segments.length - 1];

  return {
    tripProgress: 1,
    activeLegIndex: lastSegment.legIndex,
    activeLegProgress: 1,
    phase: lastSegment.kind,
  };
}

function getTravelDurationMs(leg: ItineraryLeg) {
  return leg.mode === "air" ? AIR_TRAVEL_MS : GROUND_TRAVEL_MS;
}

function hasFinalDwellStop(stops: ItineraryStop[]) {
  const finalStop = stops.at(-1);
  if (!finalStop?.arrivalDate || !finalStop.departureDate) {
    return false;
  }

  return new Date(`${finalStop.departureDate}T00:00:00Z`).getTime() >
    new Date(`${finalStop.arrivalDate}T00:00:00Z`).getTime();
}

export function buildTimelineSegments(
  legs: ItineraryLeg[],
  stops: ItineraryStop[] = []
): TimelineSegment[] {
  return legs.flatMap((leg, legIndex) => {
    const travelSegment: TimelineSegment = {
      kind: "travel",
      legIndex,
      durationMs: getTravelDurationMs(leg),
    };

    if (legIndex === legs.length - 1) {
      if (!hasFinalDwellStop(stops)) {
        return [travelSegment];
      }

      return [travelSegment];
    }

    return [
      travelSegment,
      {
        kind: "dwell",
        legIndex,
        durationMs: DWELL_MS,
      } satisfies TimelineSegment,
    ];
  }).concat(
    hasFinalDwellStop(stops) && legs.length > 0
      ? [
          {
            kind: "dwell" as const,
            legIndex: legs.length - 1,
            durationMs: DWELL_MS,
          },
        ]
      : []
  );
}

export function getTotalTimelineDurationMs(
  segments: TimelineSegment[],
  speed: PlaybackSpeed
) {
  const totalDurationMs = segments.reduce(
    (sum, segment) => sum + segment.durationMs,
    0
  );

  return totalDurationMs / speed;
}

function clampProgress(progress: number) {
  return Math.max(0, Math.min(1, progress));
}

export function getTimelineFrameFromTripProgress(
  segments: TimelineSegment[],
  tripProgress: number,
  speed: PlaybackSpeed
): TimelineFrame {
  const clampedProgress = clampProgress(tripProgress);

  if (segments.length === 0) {
    return {
      tripProgress: clampedProgress,
      activeLegIndex: 0,
      activeLegProgress: 0,
      phase: "travel",
    };
  }

  const totalDurationMs = getTotalTimelineDurationMs(segments, speed);
  const targetElapsedMs = clampedProgress * totalDurationMs;
  let traversedMs = 0;

  for (const segment of segments) {
    const segmentDurationMs = segment.durationMs / speed;
    const segmentEndMs = traversedMs + segmentDurationMs;

    if (targetElapsedMs <= segmentEndMs || segment === segments[segments.length - 1]) {
      const segmentProgress =
        segmentDurationMs === 0
          ? 1
          : Math.max(0, Math.min(1, (targetElapsedMs - traversedMs) / segmentDurationMs));

      return {
        tripProgress: clampedProgress,
        activeLegIndex: segment.legIndex,
        activeLegProgress:
          segment.kind === "travel" ? segmentProgress : 1,
        phase: segment.kind,
      };
    }

    traversedMs = segmentEndMs;
  }

  return getFinalTimelineFrame(segments);
}

export function getTripProgressFromLegPosition(
  segments: TimelineSegment[],
  legIndex: number,
  legProgress: number,
  phase: PlaybackPhase,
  speed: PlaybackSpeed
) {
  if (segments.length === 0) {
    return 0;
  }

  const totalDurationMs = getTotalTimelineDurationMs(segments, speed);
  let elapsedMs = 0;

  for (const segment of segments) {
    const segmentDurationMs = segment.durationMs / speed;

    if (segment.legIndex === legIndex && segment.kind === phase) {
      const segmentProgress = phase === "dwell" ? 0 : clampProgress(legProgress);
      const targetElapsedMs = elapsedMs + segmentDurationMs * segmentProgress;
      return totalDurationMs === 0 ? 0 : targetElapsedMs / totalDurationMs;
    }

    elapsedMs += segmentDurationMs;
  }

  return 1;
}

export function getTripProgressForLegStart(
  segments: TimelineSegment[],
  legIndex: number,
  speed: PlaybackSpeed
) {
  const tripProgress = getTripProgressFromLegPosition(
    segments,
    legIndex,
    0,
    "travel",
    speed
  );

  if (legIndex <= 0) {
    return tripProgress;
  }

  // Nudge past the previous segment boundary so timeline lookup resolves to the
  // requested leg's travel segment instead of the prior dwell segment.
  return Math.min(1, tripProgress + 1e-6);
}

export function getTripProgressForLegEnd(
  segments: TimelineSegment[],
  legIndex: number,
  speed: PlaybackSpeed
) {
  return getTripProgressFromLegPosition(segments, legIndex, 1, "travel", speed);
}
