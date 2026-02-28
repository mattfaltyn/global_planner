import {
  buildDatasetFromSources,
  estimateDurationMin,
  haversineDistanceKm,
  normalizeAirportRow,
  parseRawAirports,
  parseRawRoutes,
} from "../../lib/data/buildDataset";

function buildDenseAirportsCsv() {
  const lines = [
    "Airport ID,Name,City,Country,IATA,ICAO,Latitude,Longitude,Altitude,Timezone,DST,Tz database time zone,Type,Source",
  ];

  for (let index = 1; index <= 34; index += 1) {
    lines.push(
      [
        index,
        `Airport ${index}`,
        `City ${index}`,
        "Testland",
        `A${String(index).padStart(2, "0")}`,
        `ICA${String(index).padStart(2, "0")}`,
        10 + index,
        20 + index,
        100 + index,
        0,
        "U",
        "Etc/UTC",
        "airport",
        "OurAirports",
      ].join(",")
    );
  }

  return lines.join("\n");
}

function buildDenseRoutesCsv() {
  const lines = [
    "Airline,Airline ID,Source airport,Source airport ID,Destination airport,Destination airport ID,Codeshare,Stops,Equipment",
  ];

  for (let source = 1; source <= 31; source += 1) {
    for (let destination = source + 1; destination <= 34; destination += 1) {
      lines.push(
        `XX,1,S${source},${source},D${destination},${destination},,0,738`
      );
      lines.push(
        `XX,1,D${destination},${destination},S${source},${source},,0,738`
      );
    }
  }

  return lines.join("\n");
}

describe("buildDataset helpers", () => {
  it("normalizes placeholder values to null", () => {
    const airport = normalizeAirportRow({
      "Airport ID": "4",
      Name: "Null Code Airport",
      City: "Null City",
      Country: "Null Land",
      IATA: "\\N",
      ICAO: "\\N",
      Latitude: "18",
      Longitude: "30",
      Altitude: "400",
      Timezone: "0",
      DST: "U",
      "Tz database time zone": "\\N",
      Type: "airport",
      Source: "OurAirports",
    });

    expect(airport.iata).toBeNull();
    expect(airport.icao).toBeNull();
    expect(airport.tzName).toBeNull();
  });

  it("keeps only nonstop routes", () => {
    const routes = parseRawRoutes(`Airline,Airline ID,Source airport,Source airport ID,Destination airport,Destination airport ID,Codeshare,Stops,Equipment
XX,1,AAA,1,BBB,2,,0,738
XX,1,AAA,1,CCC,3,,1,738`);

    expect(routes).toHaveLength(1);
    expect(routes[0]["Destination airport ID"]).toBe("2");
  });

  it("drops non-airport rows and invalid coordinates", () => {
    const airports = parseRawAirports(`Airport ID,Name,City,Country,IATA,ICAO,Latitude,Longitude,Altitude,Timezone,DST,Tz database time zone,Type,Source
1,Alpha Airport,Alpha City,Alpha Land,AAA,AAAA,10,20,100,0,U,Etc/UTC,airport,OurAirports
2,Invalid Latitude Airport,Beta City,Beta Land,BBB,BBBB,abc,24,200,0,U,Etc/UTC,airport,OurAirports
3,Train Station,Gamma City,Gamma Land,CCC,CCCC,14,28,300,0,U,Etc/UTC,station,OurAirports`);

    expect(airports).toHaveLength(1);
    expect(airports[0].id).toBe("1");
  });

  it("builds a filtered dataset with canonical undirected routes", () => {
    const dataset = buildDatasetFromSources(buildDenseAirportsCsv(), buildDenseRoutesCsv());

    expect(dataset.manifest.airportCount).toBe(34);
    expect(dataset.routes[0].id).toContain("__");
    expect(dataset.routes[0].directionality).toBe("bidirectional");
  });

  it("computes distance and duration helpers", () => {
    expect(Math.round(haversineDistanceKm(40.6413, -73.7781, 51.47, -0.4543))).toBe(
      5540
    );
    expect(estimateDurationMin(780)).toBe(85);
  });
});
