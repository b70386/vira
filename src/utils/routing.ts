// Utility untuk pengambilan data rute, elevasi, dan POI
import { RouteData, RouteAnalysis, ElevationData, POI, POIType } from '../types';

// Cache untuk data elevasi
const elevationCache = new Map<string, number>();

/**
 * Mencari lokasi menggunakan Nominatim API (OpenStreetMap)
 */
export async function searchLocation(query: string): Promise<Array<{
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}>> {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=id&limit=5`,
    {
      headers: {
        'Accept': 'application/json',
      }
    }
  );
  
  if (!response.ok) throw new Error('Gagal mencari lokasi');
  return response.json();
}

/**
 * Mendapatkan rute menggunakan OSRM (Open Source Routing Machine) - gratis tanpa API key
 * Mendukung multi-waypoint (hingga 4 titik)
 */
export async function getRoute(waypoints: {lat: number; lng: number}[]): Promise<RouteData> {
  const coordsStr = waypoints.map(w => `${w.lng},${w.lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson&steps=true`;
  
  const response = await fetch(url);
  if (!response.ok) throw new Error('Gagal mendapatkan rute');
  
  const data = await response.json();
  
  if (!data.routes || data.routes.length === 0) {
    throw new Error('Tidak ada rute yang ditemukan');
  }
  
  const route = data.routes[0];
  const coordinates: [number, number][] = route.geometry.coordinates;
  
  // Konversi ke RoutePoint
  const points = coordinates.map((coord: [number, number], index: number) => ({
    lat: coord[1],
    lng: coord[0],
    distance: 0
  }));
  
  // Hitung jarak kumulatif
  let totalDistance = 0;
  for (let i = 1; i < points.length; i++) {
    const dist = haversineDistance(points[i-1].lat, points[i-1].lng, points[i].lat, points[i].lng);
    totalDistance += dist;
    points[i].distance = totalDistance;
  }
  
  return {
    points,
    distance_km: route.distance / 1000,
    duration_minutes: route.duration / 60,
    geometry: coordinates
  };
}

/**
 * Mendapatkan data elevasi untuk titik-titik sepanjang rute
 * Menggunakan Open-Elevation API dengan sampling lebih rapat untuk akurasi tanjakan
 */
export async function getElevationData(points: {lat: number; lng: number; distance?: number}[]): Promise<ElevationData[]> {
  // Sampling lebih rapat: setiap ~150m (bukan 500m) untuk akurasi tanjakan pendek
  // Tapi batasi max 120 titik agar tidak overload API
  const sampleRate = Math.max(1, Math.floor(points.length / 120));
  const sampledPoints = points.filter((_, i) => i % sampleRate === 0 || i === points.length - 1);
  
  // Cek cache dulu
  const uncachedPoints: {lat: number; lng: number; distance?: number; index: number}[] = [];
  const results: (ElevationData | null)[] = new Array(sampledPoints.length).fill(null);
  
  sampledPoints.forEach((point, index) => {
    const key = `${point.lat.toFixed(4)},${point.lng.toFixed(4)}`;
    if (elevationCache.has(key)) {
      results[index] = {
        distance_km: 0,
        elevation_m: elevationCache.get(key)!,
        gradient: 0
      };
    } else {
      uncachedPoints.push({ ...point, index });
    }
  });
  
  // Request elevasi untuk titik yang belum ada di cache
  if (uncachedPoints.length > 0) {
    const batchSize = 40;
    for (let i = 0; i < uncachedPoints.length; i += batchSize) {
      const batch = uncachedPoints.slice(i, i + batchSize);
      const locations = batch.map(p => ({ latitude: p.lat, longitude: p.lng }));
      
      try {
        const response = await fetch('https://api.open-elevation.com/api/v1/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locations })
        });
        
        if (response.ok) {
          const data = await response.json();
          data.results.forEach((result: { latitude: number; longitude: number; elevation: number }, idx: number) => {
            const key = `${batch[idx].lat.toFixed(4)},${batch[idx].lng.toFixed(4)}`;
            elevationCache.set(key, result.elevation);
            results[batch[idx].index] = {
              distance_km: 0,
              elevation_m: result.elevation,
              gradient: 0
            };
          });
        }
      } catch (error) {
        console.warn('Open-Elevation API gagal, menggunakan estimasi');
        uncachedPoints.forEach((p) => {
          const estimatedElevation = estimateElevation(p.lat, p.lng);
          const key = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
          elevationCache.set(key, estimatedElevation);
          results[p.index] = {
            distance_km: 0,
            elevation_m: estimatedElevation,
            gradient: 0
          };
        });
      }
    }
  }
  
  // Hitung jarak dan gradient dengan smoothing
  const elevationProfile: ElevationData[] = [];
  let prevElevation = 0;
  let prevDistance = 0;
  
  // Kumpulkan elevasi mentah dulu
  const rawElevations: { distance_km: number; elevation_m: number }[] = [];
  for (let i = 0; i < sampledPoints.length; i++) {
    const elevation = results[i]?.elevation_m ?? 0;
    const distance = sampledPoints[i].distance 
      ? sampledPoints[i].distance! / 1000 
      : calculateCumulativeDistance(sampledPoints, i);
    rawElevations.push({ distance_km: distance, elevation_m: elevation });
  }
  
  // Smoothing: gunakan moving average window 3 titik untuk mengurangi noise
  const smoothedElevations = rawElevations.map((point, i) => {
    if (i === 0 || i === rawElevations.length - 1) return point.elevation_m;
    const prev = rawElevations[i - 1].elevation_m;
    const next = rawElevations[i + 1].elevation_m;
    return (prev + point.elevation_m + next) / 3;
  });
  
  // Hitung gradient dengan window yang lebih besar (5 titik) untuk akurasi
  for (let i = 0; i < rawElevations.length; i++) {
    const elevation = smoothedElevations[i];
    const distance = rawElevations[i].distance_km;
    
    // Hitung gradient menggunakan window 5 titik ke depan (jika tersedia)
    let gradient = 0;
    const windowSize = Math.min(5, rawElevations.length - 1 - i);
    if (windowSize > 0) {
      const futureElevation = smoothedElevations[i + windowSize];
      const futureDistance = rawElevations[i + windowSize].distance_km;
      const horizontalDist = futureDistance - distance;
      if (horizontalDist > 0) {
        gradient = ((futureElevation - elevation) / (horizontalDist * 1000)) * 100;
      }
    } else if (i > 0) {
      // Fallback: gunakan jarak dari titik sebelumnya
      const horizontalDist = distance - prevDistance;
      if (horizontalDist > 0) {
        gradient = ((elevation - prevElevation) / (horizontalDist * 1000)) * 100;
      }
    }
    
    // Filter outlier: gradient tidak mungkin > 30% untuk jalan umum di Indonesia
    const clampedGradient = Math.abs(gradient) > 30 ? 0 : gradient;
    
    elevationProfile.push({
      distance_km: distance,
      elevation_m: elevation,
      gradient: clampedGradient
    });
    
    prevElevation = elevation;
    prevDistance = distance;
  }
  
  return elevationProfile;
}

/**
 * Estimasi elevasi berdasarkan koordinat (fallback jika API gagal)
 */
function estimateElevation(lat: number, lng: number): number {
  let elevation = 50;
  
  // Manado area: dataran rendah dengan bukit di sekitar
  if (lat > 1.3 && lat < 1.6 && lng > 124.7 && lng < 125.0) {
    elevation = 10 + Math.random() * 80;
  }
  // Limboto/Gorontalo: sekitar danau, dataran rendah
  else if (lat > 0.4 && lat < 0.7 && lng > 122.8 && lng < 123.2) {
    elevation = 5 + Math.random() * 50;
  }
  // Trans Sulawesi (pegunungan tengah)
  else if (lat > -2 && lat < 2 && lng > 119.5 && lng < 124) {
    elevation = 200 + Math.random() * 600;
  }
  // Jawa Tengah/Yogyakarta: pegunungan
  else if (lat > -8.0 && lat < -7.0 && lng > 109 && lng < 112) {
    elevation = 300 + Math.random() * 500;
  }
  // Sumatera Barat: Bukit Barisan
  else if (lat > -2 && lat < 1 && lng > 99 && lng < 102) {
    elevation = 400 + Math.random() * 800;
  }
  // Dataran rendah umum
  else {
    elevation = 10 + Math.random() * 100;
  }
  
  return Math.round(elevation);
}

function calculateCumulativeDistance(points: {lat: number; lng: number; distance?: number}[], upToIndex: number): number {
  let distance = 0;
  for (let i = 1; i <= upToIndex && i < points.length; i++) {
    distance += haversineDistance(points[i-1].lat, points[i-1].lng, points[i].lat, points[i].lng);
  }
  return distance / 1000;
}

/**
 * Analisis rute berdasarkan data elevasi
 * Tidak menghitung river_crossings karena tidak akurat
 */
export function analyzeRoute(elevationProfile: ElevationData[]): RouteAnalysis {
  if (elevationProfile.length === 0) {
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
      elevation_profile: []
    };
  }
  
  let totalAscent = 0;
  let totalDescent = 0;
  let maxElevation = -Infinity;
  let minElevation = Infinity;
  let maxGradient = 0;
  let totalGradient = 0;
  const steepSegments: { km: number; gradient: number }[] = [];
  
  for (let i = 0; i < elevationProfile.length; i++) {
    const point = elevationProfile[i];
    
    if (point.elevation_m > maxElevation) maxElevation = point.elevation_m;
    if (point.elevation_m < minElevation) minElevation = point.elevation_m;
    
    if (i > 0) {
      const prevPoint = elevationProfile[i - 1];
      const elevationDiff = point.elevation_m - prevPoint.elevation_m;
      
      if (elevationDiff > 0) totalAscent += elevationDiff;
      else totalDescent += Math.abs(elevationDiff);
      
      const absGradient = Math.abs(point.gradient);
      if (absGradient > maxGradient) maxGradient = absGradient;
      totalGradient += absGradient;
      
      if (absGradient > 8) {
        steepSegments.push({ km: point.distance_km, gradient: point.gradient });
      }
    }
  }
  
  return {
    total_ascent_m: totalAscent,
    total_descent_m: totalDescent,
    max_elevation_m: maxElevation === -Infinity ? 0 : maxElevation,
    min_elevation_m: minElevation === Infinity ? 0 : minElevation,
    max_gradient: maxGradient,
    avg_gradient: totalGradient / elevationProfile.length,
    steep_segments: steepSegments,
    off_road_segments: 0, // Tidak diestimasi lagi karena tidak akurat
    river_crossings: 0,   // Tidak diestimasi lagi karena tidak akurat
    elevation_profile: elevationProfile
  };
}

/**
 * Query POI (SPBU, Indomaret, Alfamart) di sepanjang rute menggunakan Overpass API
 * Buffer 500m di sekitar rute
 */
export async function queryPOIsAlongRoute(
  routeCoordinates: [number, number][] // [lat, lng]
): Promise<POI[]> {
  if (routeCoordinates.length === 0) return [];
  
  // Hitung bounding box dari rute
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  for (const [lat, lng] of routeCoordinates) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  
  // Tambah buffer sekitar 0.02 derajat (~2km) untuk menangkap POI di sekitar rute
  const buffer = 0.02;
  minLat -= buffer;
  maxLat += buffer;
  minLng -= buffer;
  maxLng += buffer;
  
  // Query menggunakan bounding box dengan berbagai variasi tag
  // Di OSM Indonesia, POI bisa menggunakan tag: brand, operator, name, atau kombinasi
  const overpassQuery = `
[out:json][timeout:30];
(
  // SPBU - semua variasi
  node["amenity"="fuel"](${minLat},${minLng},${maxLat},${maxLng});
  
  // Indomaret - berbagai tag yang mungkin digunakan
  node["brand"="Indomaret"](${minLat},${minLng},${maxLat},${maxLng});
  node["operator"="Indomaret"](${minLat},${minLng},${maxLat},${maxLng});
  node["name"~"Indomaret",i](${minLat},${minLng},${maxLat},${maxLng});
  node["shop"="convenience"]["name"~"Indomaret",i](${minLat},${minLng},${maxLat},${maxLng});
  node["shop"="supermarket"]["name"~"Indomaret",i](${minLat},${minLng},${maxLat},${maxLng});
  
  // Alfamart - berbagai tag yang mungkin digunakan
  node["brand"="Alfamart"](${minLat},${minLng},${maxLat},${maxLng});
  node["operator"="Alfamart"](${minLat},${minLng},${maxLat},${maxLng});
  node["name"~"Alfamart",i](${minLat},${minLng},${maxLat},${maxLng});
  node["shop"="convenience"]["name"~"Alfamart",i](${minLat},${minLng},${maxLat},${maxLng});
  node["shop"="supermarket"]["name"~"Alfamart",i](${minLat},${minLng},${maxLat},${maxLng});
  
  // Alfamidi
  node["brand"="Alfamidi"](${minLat},${minLng},${maxLat},${maxLng});
  node["name"~"Alfamidi",i](${minLat},${minLng},${maxLat},${maxLng});
);
out body;
`;
  
  try {
    console.log('Overpass query:', overpassQuery);
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(overpassQuery)}`
    });
    
    if (!response.ok) {
      console.warn('Overpass API gagal:', response.status, response.statusText);
      return [];
    }
    
    const data = await response.json();
    const elements = data.elements || [];
    console.log(`[POI Query] Elements found: ${elements.length}`);
    
    // Log beberapa contoh untuk debugging
    if (elements.length > 0) {
      console.log('[POI Query] Sample elements:', elements.slice(0, 3).map((el: any) => ({
        id: el.id,
        type: el.type,
        tags: el.tags
      })));
    }
    
    // Konversi ke POI dan hitung jarak terdekat dari rute
    const pois: POI[] = [];
    const seen = new Set<string>();
    
    for (const el of elements) {
      if (!el.lat || !el.lon) continue;
      
      // Dedup berdasarkan koordinat (hindari duplikasi)
      const key = `${el.lat.toFixed(4)},${el.lon.toFixed(4)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      
      // Tentukan tipe POI
      let type: POIType = 'other';
      let name = el.tags?.name || '';
      let brand = el.tags?.brand || '';
      let operator = el.tags?.operator || '';
      const combined = `${name} ${brand} ${operator}`.toLowerCase();
      
      if (el.tags?.amenity === 'fuel' || combined.includes('spbu') || combined.includes('pertamina') || combined.includes('shell') || combined.includes('bp ') || combined.includes('vivo')) {
        type = 'spbu';
        if (!name) name = brand || operator || 'SPBU';
      } else if (combined.includes('indomaret')) {
        type = 'indomaret';
        if (!name) name = 'Indomaret';
      } else if (combined.includes('alfamart') || combined.includes('alfamidi')) {
        type = 'alfamart';
        if (!name) name = brand || operator || 'Alfamart';
      } else {
        // Skip POI yang tidak jelas tipenya
        continue;
      }
      
      // Hitung jarak terdekat dari rute
      let minDistanceKm = Infinity;
      for (const coord of routeCoordinates) {
        const dist = haversineDistance(el.lat, el.lon, coord[0], coord[1]);
        if (dist < minDistanceKm) minDistanceKm = dist;
      }
      
      // Filter: hanya tampilkan POI yang dalam radius 1km dari rute
      if (minDistanceKm > 1000) continue;
      
      // Hitung jarak dari titik awal rute (sepanjang rute)
      const distanceFromStart = estimateDistanceAlongRoute(
        el.lat, el.lon, routeCoordinates
      );
      
      pois.push({
        lat: el.lat,
        lng: el.lon,
        name,
        type,
        brand,
        distance_from_route_m: minDistanceKm,
        distance_from_start_km: distanceFromStart
      });
    }
    
    // Sort berdasarkan jarak dari start
    pois.sort((a, b) => a.distance_from_start_km - b.distance_from_start_km);
    
    console.log(`[POI Query] Final POIs after filtering: ${pois.length}`);
    console.log('[POI Query] Breakdown:', {
      spbu: pois.filter(p => p.type === 'spbu').length,
      indomaret: pois.filter(p => p.type === 'indomaret').length,
      alfamart: pois.filter(p => p.type === 'alfamart').length
    });
    
    return pois;
  } catch (error) {
    console.warn('Gagal query POI:', error);
    return [];
  }
}

/**
 * Estimasi jarak POI dari titik awal rute (proyeksi ke rute terdekat)
 * Return rasio 0-1 yang akan di-scale ke km actual di caller
 */
function estimateDistanceAlongRoute(
  poiLat: number,
  poiLng: number,
  routeCoordinates: [number, number][]
): number {
  let minDistance = Infinity;
  let closestIdx = 0;
  
  for (let i = 0; i < routeCoordinates.length; i++) {
    const dist = haversineDistance(poiLat, poiLng, routeCoordinates[i][0], routeCoordinates[i][1]);
    if (dist < minDistance) {
      minDistance = dist;
      closestIdx = i;
    }
  }
  
  // Return rasio posisi POI di sepanjang rute (0 = start, 1 = end)
  return closestIdx / Math.max(1, routeCoordinates.length - 1);
}

/**
 * Haversine formula untuk menghitung jarak antara 2 titik koordinat (dalam meter)
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
