import type { ItineraryLeg, ItineraryStop } from "../../lib/data/types";
import { getTravelModeCounts } from "../../lib/state/selectors";
import styles from "./GlobeLegend.module.css";

type GlobeLegendProps = {
  stops: ItineraryStop[];
  legs: ItineraryLeg[];
};

export function GlobeLegend({ stops, legs }: GlobeLegendProps) {
  const modeCounts = getTravelModeCounts(legs);

  return (
    <aside className={styles.legend}>
      <p className={styles.kicker}>Trip planner</p>
      <h2 className={styles.title}>Travel itinerary</h2>
      <dl className={styles.stats}>
        <div>
          <dt>Stops</dt>
          <dd>{stops.length}</dd>
        </div>
        <div>
          <dt>Legs</dt>
          <dd>{legs.length}</dd>
        </div>
      </dl>
      <dl className={styles.stats}>
        <div>
          <dt>Air</dt>
          <dd>{modeCounts.air}</dd>
        </div>
        <div>
          <dt>Ground</dt>
          <dd>{modeCounts.ground}</dd>
        </div>
      </dl>
      <p className={styles.copy}>
        Add stops from search, set each leg to air or ground, and press play to
        animate the route.
      </p>
    </aside>
  );
}
