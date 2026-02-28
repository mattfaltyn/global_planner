import type { AirportRecord } from "../../lib/data/types";
import styles from "./SearchResults.module.css";

type SearchResultsProps = {
  results: AirportRecord[];
  activeIndex: number;
  onSelect: (airport: AirportRecord) => void;
};

export function SearchResults({
  results,
  activeIndex,
  onSelect,
}: SearchResultsProps) {
  return (
    <ul className={styles.results} role="listbox">
      {results.map((airport, index) => (
        <li key={airport.id}>
          <button
            type="button"
            className={index === activeIndex ? styles.active : styles.item}
            onMouseDown={(event) => {
              event.preventDefault();
              onSelect(airport);
            }}
          >
            <span className={styles.primary}>{airport.name}</span>
            <span className={styles.secondary}>
              {airport.city}, {airport.country}
            </span>
            <span className={styles.code}>{airport.iata ?? airport.icao ?? "N/A"}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
