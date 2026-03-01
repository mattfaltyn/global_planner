"use client";

import { useEffect, useState } from "react";
import type { AirportRecord } from "../../lib/data/types";
import { SearchResults } from "./SearchResults";
import styles from "./SearchBox.module.css";

type SearchBoxProps = {
  query: string;
  results: AirportRecord[];
  placeholder?: string;
  onQueryChange: (value: string) => void;
  onSelect: (airport: AirportRecord) => void;
};

export function SearchBox({
  query,
  results,
  placeholder = "Search by airport, city, IATA, or ICAO",
  onQueryChange,
  onSelect,
}: SearchBoxProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const hasResults = query.trim().length > 0 && results.length > 0;

  return (
    <div className={styles.wrap}>
      <label className={styles.label} htmlFor="airport-search">
        Search airports
      </label>
      <input
        id="airport-search"
        className={styles.input}
        placeholder={placeholder}
        autoComplete="off"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if (!hasResults) {
            return;
          }

          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((current) => Math.min(current + 1, results.length - 1));
          }

          if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((current) => Math.max(current - 1, 0));
          }

          if (event.key === "Enter") {
            event.preventDefault();
            onSelect(results[activeIndex]);
          }

          if (event.key === "Escape") {
            onQueryChange("");
          }
        }}
      />

      {hasResults ? (
        <SearchResults
          results={results}
          activeIndex={activeIndex}
          onSelect={onSelect}
        />
      ) : null}
    </div>
  );
}
