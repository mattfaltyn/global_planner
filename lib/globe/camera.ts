export type GlobePointOfView = {
  lat: number;
  lng: number;
  altitude: number;
};

export function getAirportPointOfView(lat: number, lng: number): GlobePointOfView {
  return {
    lat,
    lng,
    altitude: 1.6,
  };
}

export function getFlyDurationMs(isClose: boolean) {
  return isClose ? 450 : 900;
}
