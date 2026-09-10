import { RouteData, RouteAnalysis, ElevationData, POI, POIType } from '../types';
import { API, ROUTING, EARTH_RADIUS } from './constants';

const elevationCache = new Map<string, number>();

/**
 * Search locations by name using OpenStreetMap Nominatim API
 */
export async function searchLocation(query: string) {
  const params = new URLSearchParams({
    ...API.NOMINATIM.params,
    q: query,
  });

  const response = await fetch(`${API.NOMINATIM.base}?${params}`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) throw new Error('Gagal mencari lokasi');
  return response.json();
}

/**
 * Get routing data between waypoints using OSRM
 * Supports up to 4 waypoints for multi-stop routes
 */
export async function getRoute(waypoints: { lat: number; lng: number }[]): Promise<RouteData> {
  const coords = waypoints.map((w) => `${w.lng},${w.lat}`).join(';');
  const params = new URLSearchParams(API.OSRM.params);
  const url = `${API.OSRM.base}/${coords}?${params}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error('Gagal mendapatkan rute');

  const data = await response.json();
  if (!data.routes?.length) throw new Error('Tidak ada rute yang ditemukan');

  const route = data.routes[0];
  const coords_list: [number, number][] = route.geometry.coordinates;

  const points = coords_list.map(([lng, lat]) => ({
    lat,
    lng,
    distance: 0,
  }));

  // Calculate cumulative distance along route
  let cumDist = 0;
  for (let i = 1; i < points.length; i++) {
    cumDist += haversine(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
    points[i].distance = cumDist;
  }

  return {
    points,
    distance_km: route.distance / 1000,
    duration_minutes: route.duration / 60,
    geometry: coords_list,
  };
}

/**
 * Fetch elevation data along route with smoothing and gradient calculation
 * Uses caching and batch requests to minimize API calls
 */
export async function getElevationData(
  points: { lat: number; lng: number; distance?: number }[]
): Promise<ElevationData[]> {
  // Sample points: aim for ~150m intervals, max 120 points
  const sampleRate = Math.max(1, Math.floor(points.length / API.ELEVATION.maxPoints));
  const sampled = points.filter((_, i) => i % sampleRate === 0 || i === points.length - 1);

  // Separate cached vs uncached
  const uncached: { lat: number; lng: number; distance?: number; idx: number }[] = [];
  const results: (ElevationData | null)[] = new Array(sampled.length).fill(null);

  sampled.forEach((p, idx) => {
    const key = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
    const cached = elevationCache.get(key);

    if (cached !== undefined) {
      results[idx] = { distance_km: 0, elevation_m: cached, gradient: 0 };
    } else {
      uncached.push({ ...p, idx });
    }
  });

  // Batch fetch from API
  if (uncached.length > 0) {
    for (let i = 0; i < uncached.length; i += API.ELEVATION.batchSize) {
      const batch = uncached.slice(i, i + API.ELEVATION.batchSize);
      const locations = batch.map((p) => ({ latitude: p.lat, longitude: p.lng }));

      try {
        const response = await fetch(API.ELEVATION.base, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locations }),
        });

        if (response.ok) {
          const data = await response.json();
          data.results?.forEach(
            (
              el: { latitude: number; longitude: number; elevation: number },
              resultIdx: number
            ) => {
              const key = `${batch[resultIdx].lat.toFixed(4)},${batch[resultIdx].lng.toFixed(4)}`;
              const elev = el.elevation;
              elevationCache.set(key, elev);
              results[batch[resultIdx].idx] = {
                distance_km: 0,
                elevation_m: elev,
                gradient: 0,
              };
            }
          );
        }
      } catch (err) {
        // Fallback: estimate from coordinates
        batch.forEach((p) => {
          const est = estimateElevation(p.lat, p.lng);
          const key = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
          elevationCache.set(key, est);
          results[p.idx] = { distance_km: 0, elevation_m: est, gradient: 0 };
        });
      }
    }
  }

  // Build elevation profile with smoothing
  const raw: { distance_km: number; elevation_m: number }[] = sampled.map((p, i) => ({
    distance_km: p.distance ? p.distance / 1000 : cumulativeDist(sampled, i),
    elevation_m: results[i]?.elevation_m ?? 0,
  }));

  // 3-point moving average to reduce noise
  const smoothed = raw.map((pt, i) => {
    if (i === 0 || i === raw.length - 1) return pt.elevation_m;
    return (raw[i - 1].elevation_m + pt.elevation_m + raw[i + 1].elevation_m) / 3;
  });

  // Calculate gradients using 5-point window
  const profile: ElevationData[] = [];
  for (let i = 0; i < raw.length; i++) {
    const windowSize = Math.min(5, raw.length - 1 - i);
    let grad = 0;

    if (windowSize > 0) {
      const dElev = smoothed[i + windowSize] - smoothed[i];
      const dDist = (raw[i + windowSize].distance_km - raw[i].distance_km) * 1000;
      grad = dDist > 0 ? (dElev / dDist) * 100 : 0;
    }

    // Clamp outliers
    grad = Math.abs(grad) > ROUTING.gradientOutlierThreshold ? 0 : grad;

    profile.push({
      distance_km: raw[i].distance_km,
      elevation_m: smoothed[i],
      gradient: grad,
    });
  }

  return profile;
}

/**
 * Estimate elevation from coordinates (fallback when API fails)
 * Uses geographic region-based estimates for Indonesian terrain
 */
function estimateElevation(lat: number, lng: number): number {
  // Regional elevation estimates
  if (lat > 1.3 && lat < 1.6 && lng > 124.7 && lng < 125.0) return 10 + Math.random() * 80; // Manado
  if (lat > 0.4 && lat < 0.7 && lng > 122.8 && lng < 123.2) return 5 + Math.random() * 50; // Gorontalo
  if (lat > -2 && lat < 2 && lng > 119.5 && lng < 124) return 200 + Math.random() * 600; // Sulawesi mountains
  if (lat > -8.0 && lat < -7.0 && lng > 109 && lng < 112) return 300 + Math.random() * 500; // Central Java
  if (lat > -2 && lat < 1 && lng > 99 && lng < 102) return 400 + Math.random() * 800; // Sumatera
  return 10 + Math.random() * 100; // Lowlands (default)
}

function cumulativeDist(points: { lat: number; lng: number; distance?: number }[], upTo: number): number {
  let sum = 0;
  for (let i = 1; i <= upTo && i < points.length; i++) {
    sum += haversine(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
  }
  return sum / 1000;
}

/**
 * Analyze elevation profile to extract route characteristics
 */
export function analyzeRoute(profile: ElevationData[]): RouteAnalysis {
  if (profile.length === 0) {
    return {
      total_ascent_m: 0,
      total_descent_m: 0,
      max_elevation_m: 0,
      min_elevation_m: 0,
      max_gradient: 0,
      avg_gradient: 0,
      steep_segments: [],
      off_road_segments: 0,
      river_crossings: 0,
      elevation_profile: [],
    };
  }

  let ascent = 0, descent = 0, maxElev = -Infinity, minElev = Infinity, maxGrad = 0, sumGrad = 0;
  const steep: { km: number; gradient: number }[] = [];

  for (let i = 0; i < profile.length; i++) {
    const curr = profile[i];
    maxElev = Math.max(maxElev, curr.elevation_m);
    minElev = Math.min(minElev, curr.elevation_m);

    if (i > 0) {
      const prev = profile[i - 1];
      const dElev = curr.elevation_m - prev.elevation_m;
      if (dElev > 0) ascent += dElev;
      else descent += Math.abs(dElev);

      const absGrad = Math.abs(curr.gradient);
      maxGrad = Math.max(maxGrad, absGrad);
      sumGrad += absGrad;

      if (absGrad > 8) steep.push({ km: curr.distance_km, gradient: curr.gradient });
    }
  }

  return {
    total_ascent_m: ascent,
    total_descent_m: descent,
    max_elevation_m: maxElev === -Infinity ? 0 : maxElev,
    min_elevation_m: minElev === Infinity ? 0 : minElev,
    max_gradient: maxGrad,
    avg_gradient: sumGrad / profile.length,
    steep_segments: steep,
    off_road_segments: 0,
    river_crossings: 0,
    elevation_profile: profile,
  };
}

/**
 * Query POIs (gas stations, convenience stores) along route using Overpass API
 * Searches within a 2km buffer around the route
 */
export async function queryPOIsAlongRoute(routeCoords: [number, number][]): Promise<POI[]> {
  if (routeCoords.length === 0) return [];

  // Calculate bounding box
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  for (const [lat, lng] of routeCoords) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  }

  const buf = ROUTING.poiBoundaryBuffer;
  const bbox = { minLat: minLat - buf, maxLat: maxLat + buf, minLng: minLng - buf, maxLng: maxLng + buf };

  // Overpass QL queries
  const queries = {
    spbu: `[out:json][timeout:${API.OVERPASS.timeout}];
      node["amenity"="fuel"](${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng});
      out body;`,
    indomaret: `[out:json][timeout:${API.OVERPASS.timeout}];
      (node["brand"="Indomaret"](${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng});
       node["name"~"Indomaret",i](${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng}););
      out body;`,
    alfamart: `[out:json][timeout:${API.OVERPASS.timeout}];
      (node["brand"="Alfamart"](${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng});
       node["name"~"Alfamart",i](${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng};);
      out body;`,
  };

  // Fetch all POI types in parallel
  const fetchPOI = (query: string, type: POIType) =>
    fetch(API.OVERPASS.base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    })
      .then((r) => (r.ok ? r.json() : { elements: [] }))
      .then((d) => (d.elements || []).map((el: any) => ({ ...el, _type: type })))
      .catch(() => []);

  const [spbuData, indoData, alfaData] = await Promise.all([
    fetchPOI(queries.spbu, 'spbu'),
    fetchPOI(queries.indomaret, 'indomaret'),
    fetchPOI(queries.alfamart, 'alfamart'),
  ]);

  // Merge and deduplicate
  const all = [...spbuData, ...indoData, ...alfaData];
  const seen = new Set<string>();
  const pois: POI[] = [];

  for (const el of all) {
    if (!el.lat || !el.lon) continue;

    const key = `${el.lat.toFixed(4)},${el.lon.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Distance from route
    let minDist = Infinity;
    for (const [lat, lng] of routeCoords) {
      const d = haversine(el.lat, el.lon, lat, lng);
      minDist = Math.min(minDist, d);
    }

    if (minDist > ROUTING.poiMaxDistance) continue;

    // Distance along route
    const distAlongRoute = findClosestRoutePos(el.lat, el.lon, routeCoords);

    const name =
      el.tags?.name ||
      {
        spbu: el.tags?.brand || el.tags?.operator || 'SPBU',
        indomaret: 'Indomaret',
        alfamart: el.tags?.brand || 'Alfamart',
      }[el._type];

    pois.push({
      lat: el.lat,
      lng: el.lon,
      name,
      type: el._type,
      brand: el.tags?.brand || '',
      distance_from_route_m: minDist,
      distance_from_start_km: distAlongRoute,
    });
  }

  pois.sort((a, b) => a.distance_from_start_km - b.distance_from_start_km);
  return pois;
}

/**
 * Find POI's position relative to route (0 = start, 1 = end)
 */
function findClosestRoutePos(lat: number, lng: number, routeCoords: [number, number][]): number {
  let minDist = Infinity;
  let closestIdx = 0;

  for (let i = 0; i < routeCoords.length; i++) {
    const d = haversine(lat, lng, routeCoords[i][0], routeCoords[i][1]);
    if (d < minDist) {
      minDist = d;
      closestIdx = i;
    }
  }

  return closestIdx / Math.max(1, routeCoords.length - 1);
}

/**
 * Haversine distance formula (returns meters)
 */
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
