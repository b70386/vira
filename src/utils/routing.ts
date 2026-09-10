// Utility untuk pengambilan data rute dan elevasi
import { RouteData, RouteAnalysis, ElevationData } from '../types';

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
 */
export async function getRoute(startLat: number, startLng: number, endLat: number, endLng: number): Promise<RouteData> {
  const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`;
  
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
    distance: 0 // akan dihitung nanti
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
 * Menggunakan Open-Elevation API
 */
export async function getElevationData(points: {lat: number; lng: number; distance?: number}[]): Promise<ElevationData[]> {
  // Sample points untuk mengurangi jumlah request (max 100 titik)
  const sampleRate = Math.max(1, Math.floor(points.length / 80));
  const sampledPoints = points.filter((_, i) => i % sampleRate === 0 || i === points.length - 1);
  
  // Cek cache dulu
  const uncachedPoints: {lat: number; lng: number; index: number}[] = [];
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
    // Batch request (max 100 per request)
    const batchSize = 50;
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
        // Fallback: estimasi elevasi berdasarkan koordinat (sangat kasar)
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
  
  // Hitung jarak dan gradient
  const elevationProfile: ElevationData[] = [];
  let prevElevation = 0;
  let prevDistance = 0;
  
  for (let i = 0; i < sampledPoints.length; i++) {
    const elevation = results[i]?.elevation_m ?? 0;
    const distance = sampledPoints[i].distance 
      ? sampledPoints[i].distance! / 1000 
      : calculateCumulativeDistance(sampledPoints, i);
    
    const horizontalDist = distance - prevDistance;
    const gradient = horizontalDist > 0 
      ? ((elevation - prevElevation) / (horizontalDist * 1000)) * 100 
      : 0;
    
    elevationProfile.push({
      distance_km: distance,
      elevation_m: elevation,
      gradient: Math.abs(gradient) < 50 ? gradient : 0 // filter outlier
    });
    
    prevElevation = elevation;
    prevDistance = distance;
  }
  
  return elevationProfile;
}

/**
 * Estimasi elevasi berdasarkan koordinat (fallback)
 * Menggunakan pengetahuan umum tentang topografi Indonesia
 */
function estimateElevation(lat: number, lng: number): number {
  // Estimasi kasar berdasarkan wilayah di Indonesia
  // Jawa: banyak pegunungan di tengah
  // Sumatera: Bukit Barisan
  // Sulawesi: pegunungan di tengah
  
  // Base elevation dari latitude (semakin ke selatan di Jawa = lebih tinggi)
  let elevation = 50; // base
  
  // Cek apakah di area pegunungan utama Indonesia
  // Jawa Tengah/Yogyakarta: -7.5 sampai -8.0
  if (lat > -8.0 && lat < -7.0 && lng > 109 && lng < 112) {
    elevation = 300 + Math.random() * 500;
  }
  // Sumatera Barat: Bukit Barisan
  else if (lat > -2 && lat < 1 && lng > 99 && lng < 102) {
    elevation = 400 + Math.random() * 800;
  }
  // Sulawesi: pegunungan tengah
  else if (lat > -3 && lat < 2 && lng > 119 && lng < 123) {
    elevation = 200 + Math.random() * 600;
  }
  // Bali/Lombok
  else if (lat > -9 && lat < -7.5 && lng > 115 && lng < 117) {
    elevation = 100 + Math.random() * 400;
  }
  // Dataran rendah (pantai)
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
  return distance / 1000; // km
}

/**
 * Analisis rute berdasarkan data elevasi
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
      
      if (absGradient > 10) {
        steepSegments.push({ km: point.distance_km, gradient: point.gradient });
      }
    }
  }
  
  // Estimasi segmen off-road berdasarkan gradient tinggi dan elevasi
  const offRoadSegments = steepSegments.filter(s => Math.abs(s.gradient) > 15).length;
  
  // Estimasi penyeberangan sungai (berdasarkan penurunan tajam diikuti kenaikan)
  let riverCrossings = 0;
  for (let i = 2; i < elevationProfile.length; i++) {
    const prev = elevationProfile[i-2].elevation_m;
    const curr = elevationProfile[i-1].elevation_m;
    const next = elevationProfile[i].elevation_m;
    
    if (curr < prev - 20 && curr < next - 20 && curr < 50) {
      riverCrossings++;
    }
  }
  
  return {
    total_ascent_m: totalAscent,
    total_descent_m: totalDescent,
    max_elevation_m: maxElevation,
    min_elevation_m: minElevation,
    max_gradient: maxGradient,
    avg_gradient: totalGradient / elevationProfile.length,
    steep_segments: steepSegments,
    off_road_segments: Math.min(offRoadSegments, 10),
    river_crossings: Math.min(riverCrossings, 5),
    elevation_profile: elevationProfile
  };
}

/**
 * Haversine formula untuk menghitung jarak antara 2 titik koordinat
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // radius bumi dalam meter
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
