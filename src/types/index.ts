/**
 * Core type definitions for Vira - Vehicle Route Analysis Simulator
 */

/**
 * Single coordinate point along a route with elevation and distance data
 */
export interface RoutePoint {
  /** Latitude coordinate */
  lat: number;
  /** Longitude coordinate */
  lng: number;
  /** Elevation in meters (optional) */
  elevation?: number;
  /** Cumulative distance from route start in meters */
  distance?: number;
}

/**
 * Named waypoint with label for multi-stop routes
 */
export interface Waypoint {
  /** Latitude coordinate */
  lat: number;
  /** Longitude coordinate */
  lng: number;
  /** Location name (from geocoding) */
  name: string;
  /** Label for display: "A", "B", "C", "D" */
  label: string;
}

/**
 * Complete route data from routing engine
 */
export interface RouteData {
  /** Array of coordinate points along the route */
  points: RoutePoint[];
  /** Total route distance in kilometers */
  distance_km: number;
  /** Estimated travel duration in minutes */
  duration_minutes: number;
  /** GeoJSON-style coordinate pairs [lng, lat] for mapping */
  geometry: [number, number][];
}

/**
 * Elevation and gradient at a specific point along route
 */
export interface ElevationData {
  /** Distance from route start in kilometers */
  distance_km: number;
  /** Elevation above sea level in meters */
  elevation_m: number;
  /** Road gradient as percentage (-ve = downhill, +ve = uphill) */
  gradient: number;
}

/**
 * Complete route analysis with terrain characteristics
 */
export interface RouteAnalysis {
  /** Total elevation gain in meters */
  total_ascent_m: number;
  /** Total elevation loss in meters */
  total_descent_m: number;
  /** Highest point on route in meters above sea level */
  max_elevation_m: number;
  /** Lowest point on route in meters above sea level */
  min_elevation_m: number;
  /** Maximum gradient percentage encountered */
  max_gradient: number;
  /** Average gradient percentage */
  avg_gradient: number;
  /** Segments where gradient exceeds 8% */
  steep_segments: { km: number; gradient: number }[];
  /** Estimated number of off-road/unpaved segments (0 if none detected) */
  off_road_segments: number;
  /** Estimated number of river crossings (0 if none detected) */
  river_crossings: number;
  /** Complete elevation profile for visualization */
  elevation_profile: ElevationData[];
}

/**
 * Vehicle feasibility assessment result
 */
export interface FeasibilityResult {
  /** Overall feasibility score 1-10 */
  score: number;
  /** Non-critical issues that need attention */
  warnings: string[];
  /** Critical issues that impact safety/feasibility */
  criticals: string[];
  /** Positive factors supporting this vehicle choice */
  positives: string[];
  /** Actionable recommendations for the user */
  recommendations: string[];
  /** Final verdict: COCOK (suitable), PERHATIAN (caution), TIDAK COCOK (unsuitable) */
  verdict: 'COCOK' | 'PERHATIAN' | 'TIDAK COCOK';
  /** Estimated fuel cost in Indonesian Rupiah */
  estimated_fuel_cost: number;
  /** Estimated number of fuel stops needed */
  estimated_fuel_stops: number;
}

/**
 * Geocoding search result from location lookup service
 */
export interface SearchResult {
  /** Unique identifier from geocoding service */
  place_id: number;
  /** Full name/address of location */
  display_name: string;
  /** Latitude as string */
  lat: string;
  /** Longitude as string */
  lon: string;
  /** Type of location (village, town, highway, etc) */
  type: string;
}

/**
 * Point of Interest type classification
 */
export type POIType = 'spbu' | 'indomaret' | 'alfamart' | 'minimarket' | 'other';

/**
 * Point of Interest (gas station, convenience store, etc) near route
 */
export interface POI {
  /** Latitude coordinate */
  lat: number;
  /** Longitude coordinate */
  lng: number;
  /** Name/brand of facility */
  name: string;
  /** Facility type classification */
  type: POIType;
  /** Brand name if available */
  brand: string;
  /** Closest distance from route in meters */
  distance_from_route_m: number;
  /** Estimated position along route (0 = start, 1 = end) */
  distance_from_start_km: number;
}
