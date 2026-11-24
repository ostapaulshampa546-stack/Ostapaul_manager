/**
 * Simplified outline of Africa (longitude, latitude), used to build the 3D dot map.
 * Hand-simplified coastline (~110 points): accurate enough for a stylized visual, very light to ship.
 */
export const AFRICA: [number, number][] = [
  [-5.9, 35.8], [-2.0, 35.1], [1.0, 36.5], [3.0, 36.9], [8.6, 36.9], [10.2, 37.2], [11.1, 36.8], [10.9, 35.0],
  [10.1, 34.2], [11.2, 33.2], [12.5, 32.8], [15.2, 32.3], [15.7, 31.4], [18.0, 30.8], [19.6, 30.5], [20.1, 31.3],
  [20.0, 32.1], [21.5, 32.8], [23.1, 32.6], [25.0, 31.6], [29.0, 30.9], [31.0, 31.6], [32.3, 31.3], [32.5, 29.9],
  [33.6, 27.3], [35.5, 23.9], [37.2, 21.0], [37.4, 18.6], [39.0, 16.0], [41.2, 14.5], [43.3, 12.5], [44.5, 10.4],
  [47.5, 11.2], [51.2, 11.9], [51.0, 10.4], [49.8, 6.8], [48.0, 4.5], [46.0, 2.0], [43.5, -0.5], [41.0, -2.0],
  [39.6, -4.4], [39.6, -6.8], [39.7, -10.0], [40.5, -12.5], [40.6, -15.0], [37.5, -17.5], [35.3, -22.0], [35.5, -24.0],
  [32.9, -25.9], [32.4, -28.6], [30.9, -30.5], [28.0, -32.8], [25.6, -34.0], [22.0, -34.2], [20.0, -34.8], [18.4, -34.2],
  [18.2, -32.0], [16.5, -28.6], [15.2, -26.6], [14.5, -22.9], [13.2, -20.0], [11.8, -17.3], [12.0, -15.0], [12.6, -13.2],
  [13.6, -11.0], [13.2, -8.8], [12.3, -6.1], [11.8, -4.4], [9.3, -1.0], [9.6, 1.0], [9.8, 3.0], [9.6, 4.0],
  [8.5, 4.5], [7.0, 4.4], [6.0, 4.3], [4.5, 6.2], [3.4, 6.2], [1.2, 6.1], [-0.2, 5.3], [-2.0, 4.7],
  [-4.0, 5.2], [-7.5, 4.4], [-9.0, 5.0], [-10.8, 6.5], [-12.5, 7.5], [-13.6, 9.5], [-15.0, 11.0], [-16.7, 12.3],
  [-17.5, 14.7], [-16.5, 16.5], [-16.0, 19.0], [-17.0, 21.0], [-15.0, 24.5], [-13.0, 27.0], [-10.0, 29.5], [-9.8, 31.5],
  [-8.5, 33.3], [-6.8, 34.0],
];

export const MADAGASCAR: [number, number][] = [
  [49.3, -12.0], [50.4, -15.5], [49.8, -17.5], [48.0, -22.0], [47.1, -24.9], [45.2, -25.5], [43.7, -23.5],
  [43.3, -21.5], [44.4, -19.5], [44.0, -17.0], [46.5, -15.7], [47.8, -14.0],
];

export type City = { name: string; lon: number; lat: number };
export const CITIES: City[] = [
  { name: "Dakar", lon: -17.45, lat: 14.7 },
  { name: "Abidjan", lon: -4.0, lat: 5.35 },
  { name: "Accra", lon: -0.2, lat: 5.6 },
  { name: "Lagos", lon: 3.4, lat: 6.45 },
  { name: "Douala", lon: 9.7, lat: 4.05 },
  { name: "Kinshasa", lon: 15.3, lat: -4.3 },
  { name: "Luanda", lon: 13.25, lat: -8.85 },
  { name: "Johannesburg", lon: 28.05, lat: -26.2 },
  { name: "Nairobi", lon: 36.8, lat: -1.3 },
  { name: "Kigali", lon: 30.06, lat: -1.95 },
  { name: "Addis Ababa", lon: 38.75, lat: 9.0 },
  { name: "Cairo", lon: 31.25, lat: 30.05 },
  { name: "Casablanca", lon: -7.6, lat: 33.57 },
  { name: "Dar es Salaam", lon: 39.28, lat: -6.8 },
];

/** Learning exchanges drawn as arcs between cities (indexes into CITIES). */
export const LINKS: [number, number][] = [
  [3, 8], [5, 7], [0, 11], [2, 9], [12, 3], [10, 13], [1, 5], [4, 10], [6, 8], [11, 7], [0, 4], [9, 13],
];

export function pointInPolygon(x: number, y: number, poly: [number, number][]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Grid of points inside the continent. `step` in degrees: smaller = denser (use a larger step on phones). */
export function africaDots(step: number): [number, number][] {
  const out: [number, number][] = [];
  for (let lat = 37.5; lat >= -35; lat -= step) {
    for (let lon = -18; lon <= 52; lon += step) {
      if (pointInPolygon(lon, lat, AFRICA) || pointInPolygon(lon, lat, MADAGASCAR)) out.push([lon, lat]);
    }
  }
  return out;
}

/** Map projection used by the scene: centered on Africa, 1 unit ≈ 10 degrees. */
export const project = (lon: number, lat: number): [number, number] => [(lon - 17) / 10, (lat - 1) / 10];
