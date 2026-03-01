export type SeedStopInput = {
  kind: "origin" | "stay";
  city: string;
  country: string;
  arrivalDate: string | null;
  departureDate: string | null;
  notes: string;
};

export const seededItineraryStops: SeedStopInput[] = [
  {
    kind: "origin",
    city: "Vancouver",
    country: "Canada",
    arrivalDate: null,
    departureDate: "2026-02-20",
    notes: "",
  },
  {
    kind: "stay",
    city: "Porto",
    country: "Portugal",
    arrivalDate: "2026-02-21",
    departureDate: "2026-03-02",
    notes: "",
  },
  {
    kind: "stay",
    city: "Lisbon",
    country: "Portugal",
    arrivalDate: "2026-03-02",
    departureDate: "2026-03-09",
    notes: "",
  },
  {
    kind: "stay",
    city: "Faro",
    country: "Portugal",
    arrivalDate: "2026-03-09",
    departureDate: "2026-03-16",
    notes: "",
  },
  {
    kind: "stay",
    city: "Lisbon",
    country: "Portugal",
    arrivalDate: "2026-03-16",
    departureDate: "2026-03-17",
    notes: "",
  },
  {
    kind: "stay",
    city: "Barcelona",
    country: "Spain",
    arrivalDate: "2026-03-17",
    departureDate: "2026-03-22",
    notes: "",
  },
  {
    kind: "stay",
    city: "Valencia",
    country: "Spain",
    arrivalDate: "2026-03-22",
    departureDate: "2026-03-29",
    notes: "",
  },
  {
    kind: "stay",
    city: "Alicante",
    country: "Spain",
    arrivalDate: "2026-03-29",
    departureDate: "2026-04-05",
    notes: "",
  },
  {
    kind: "stay",
    city: "Madrid",
    country: "Spain",
    arrivalDate: "2026-04-05",
    departureDate: "2026-04-10",
    notes: "",
  },
];

export const seededTravelModes = [
  "air",
  "ground",
  "ground",
  "ground",
  "air",
  "ground",
  "ground",
  "ground",
] as const;
