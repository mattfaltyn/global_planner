import {
  formatCoordinates,
  formatDistance,
  formatDuration,
} from "../../lib/data/formatters";
import type {
  AirportRecord,
  DatasetIndexes,
  DestinationListItem,
  RouteRecord,
  RouteSortKey,
} from "../../lib/data/types";
import styles from "./SidePanel.module.css";

type SidePanelProps = {
  airport: AirportRecord | null;
  route: RouteRecord | null;
  destinationItems: DestinationListItem[];
  panelFilterQuery: string;
  panelSortKey: RouteSortKey;
  indexes: DatasetIndexes;
  isTouchDevice: boolean;
  onClose: () => void;
  onFilterChange: (value: string) => void;
  onSortChange: (value: RouteSortKey) => void;
  onSelectAirport: (airportId: string) => void;
  onSelectRoute: (routeId: string, airportId: string) => void;
};

function PanelMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metaItem}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function SidePanel({
  airport,
  route,
  destinationItems,
  panelFilterQuery,
  panelSortKey,
  indexes,
  isTouchDevice,
  onClose,
  onFilterChange,
  onSortChange,
  onSelectAirport,
  onSelectRoute,
}: SidePanelProps) {
  const routeAirportA = route ? indexes.airportsById.get(route.airportAId) : null;
  const routeAirportB = route ? indexes.airportsById.get(route.airportBId) : null;

  return (
    <aside
      className={isTouchDevice ? styles.mobilePanel : styles.panel}
      data-testid="side-panel"
    >
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>{route ? "Route detail" : "Airport detail"}</p>
          <h2 className={styles.title}>
            {route && routeAirportA && routeAirportB
              ? `${routeAirportA.name} ↔ ${routeAirportB.name}`
              : airport?.name}
          </h2>
        </div>
        <button type="button" className={styles.closeButton} onClick={onClose}>
          Close
        </button>
      </div>

      {route && routeAirportA && routeAirportB ? (
        <section className={styles.section}>
          <p className={styles.routeLabel}>
            {routeAirportA.city}, {routeAirportA.country} to {routeAirportB.city},{" "}
            {routeAirportB.country}
          </p>
          <dl className={styles.meta}>
            <PanelMeta label="Distance" value={formatDistance(route.distanceKm)} />
            <PanelMeta
              label="Estimated duration"
              value={formatDuration(route.estimatedDurationMin)}
            />
            <PanelMeta label="Directionality" value={route.directionality} />
          </dl>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.actionButton}
              onClick={() => onSelectAirport(routeAirportA.id)}
            >
              Jump to {routeAirportA.iata ?? routeAirportA.name}
            </button>
            <button
              type="button"
              className={styles.actionButton}
              onClick={() => onSelectAirport(routeAirportB.id)}
            >
              Jump to {routeAirportB.iata ?? routeAirportB.name}
            </button>
          </div>
        </section>
      ) : airport ? (
        <>
          <section className={styles.section}>
            <p className={styles.routeLabel}>
              {airport.city}, {airport.country}
            </p>
            <dl className={styles.meta}>
              <PanelMeta
                label="Codes"
                value={[airport.iata, airport.icao].filter(Boolean).join(" / ") || "Unavailable"}
              />
              <PanelMeta
                label="Coordinates"
                value={formatCoordinates(airport.lat, airport.lon)}
              />
              <PanelMeta
                label="Direct connections"
                value={airport.routeCount.toString()}
              />
              <PanelMeta
                label="Timezone"
                value={airport.tzName ?? "Unavailable"}
              />
            </dl>
          </section>

          <section className={styles.section}>
            <div className={styles.listHeader}>
              <h3>Connected destinations</h3>
              <span>{destinationItems.length}</span>
            </div>
            <div className={styles.controls}>
              <input
                className={styles.filterInput}
                placeholder="Filter destinations"
                value={panelFilterQuery}
                onChange={(event) => onFilterChange(event.target.value)}
              />
              <select
                className={styles.sortSelect}
                value={panelSortKey}
                onChange={(event) => onSortChange(event.target.value as RouteSortKey)}
              >
                <option value="name">Sort by name</option>
                <option value="distance">Sort by distance</option>
              </select>
            </div>
            <ul className={styles.destinationList}>
              {destinationItems.map((item) => (
                <li key={item.route.id} className={styles.destinationItem}>
                  <button
                    type="button"
                    className={styles.destinationLink}
                    onClick={() => onSelectAirport(item.airport.id)}
                  >
                    <strong>{item.airport.name}</strong>
                    <span>
                      {item.airport.city}, {item.airport.country}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={styles.routeButton}
                    onClick={() => onSelectRoute(item.route.id, airport.id)}
                  >
                    <span>{formatDistance(item.distanceKm)}</span>
                    <span>{formatDuration(item.route.estimatedDurationMin)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </aside>
  );
}
