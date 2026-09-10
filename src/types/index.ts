// Type definitions untuk aplikasi Rute Realistis

export interface RoutePoint {
  lat: number;
  lng: number;
  elevation?: number;
  distance?: number; // jarak dari titik awal dalam meter
}

export interface Waypoint {
  lat: number;
  lng: number;
  name: string;
  label: string; // "A", "B", "C", "D"
}

export interface RouteData {
  points: RoutePoint[];
  distance_km: number;
  duration_minutes: number;
  geometry: [number, number][]; // [lng, lat] pairs dari API
}

export interface ElevationData {
  distance_km: number;
  elevation_m: number;
  gradient: number; // persentase gradient
}

export interface RouteAnalysis {
  total_ascent_m: number;
  total_descent_m: number;
  max_elevation_m: number;
  min_elevation_m: number;
  max_gradient: number;
  avg_gradient: number;
  steep_segments: { km: number; gradient: number }[];
  off_road_segments: number;
  river_crossings: number;
  elevation_profile: ElevationData[];
}

export interface FeasibilityResult {
  score: number;
  warnings: string[];
  criticals: string[];
  positives: string[];
  recommendations: string[];
  verdict: "COCOK" | "PERHATIAN" | "TIDAK COCOK";
  estimated_fuel_cost: number;
  estimated_fuel_stops: number;
}

export interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
}
