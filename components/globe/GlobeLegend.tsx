import type { DatasetManifest } from "../../lib/data/types";
import styles from "./GlobeLegend.module.css";

type GlobeLegendProps = {
  manifest: DatasetManifest;
};

export function GlobeLegend({ manifest }: GlobeLegendProps) {
  return (
    <aside className={styles.legend}>
      <p className={styles.kicker}>V1 dataset</p>
      <h2 className={styles.title}>Major-airport direct route globe</h2>
      <dl className={styles.stats}>
        <div>
          <dt>Airports</dt>
          <dd>{manifest.airportCount}</dd>
        </div>
        <div>
          <dt>Routes</dt>
          <dd>{manifest.routeCount}</dd>
        </div>
      </dl>
      <p className={styles.copy}>
        Hover for a quick read. Click an airport or route to open details, search,
        and fly across the network.
      </p>
    </aside>
  );
}
