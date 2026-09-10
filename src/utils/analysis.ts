// Logika analisis kelayakan kendaraan untuk rute tertentu
import { Vehicle } from '../data/vehicles';
import { RouteAnalysis, FeasibilityResult } from '../types';

/**
 * Analisis kelayakan kendaraan untuk rute tertentu
 * Membandingkan spesifikasi kendaraan dengan kondisi medan rute
 */
export function analyzeFeasibility(vehicle: Vehicle, route: RouteAnalysis): FeasibilityResult {
  const warnings: string[] = [];
  const criticals: string[] = [];
  const positives: string[] = [];
  const recommendations: string[] = [];
  let score = 10;

  // 1. Ground clearance vs max gradient
  if (vehicle.ground_clearance_mm < 160 && route.max_gradient > 15) {
    criticals.push(`Ground clearance ${vehicle.ground_clearance_mm}mm terlalu rendah untuk tanjakan ${route.max_gradient.toFixed(1)}%`);
    score -= 3;
  } else if (vehicle.ground_clearance_mm < 180 && route.max_gradient > 12) {
    warnings.push(`Ground clearance ${vehicle.ground_clearance_mm}mm perlu perhatian untuk tanjakan ${route.max_gradient.toFixed(1)}%`);
    score -= 1;
  } else if (vehicle.ground_clearance_mm >= 200) {
    positives.push(`Ground clearance ${vehicle.ground_clearance_mm}mm cukup untuk medan rute ini`);
  }

  // 2. Drivetrain vs off-road segments
  const is2WD = vehicle.drivetrain.includes("RWD") || vehicle.drivetrain.includes("FWD");
  if (is2WD && route.off_road_segments > 0) {
    criticals.push(`Kendaraan ${vehicle.drivetrain} tidak cocok untuk ${route.off_road_segments} segmen off-road`);
    score -= 4;
  } else if (is2WD && route.max_gradient > 15) {
    warnings.push(`Kendaraan ${vehicle.drivetrain} akan kesulitan di tanjakan curam >15%`);
    score -= 2;
  } else if (!is2WD) {
    positives.push(`${vehicle.drivetrain} tersedia untuk menangani medan berat`);
  }

  // 3. Range vs jarak rute
  const distanceKm = route.elevation_profile.length > 0 
    ? route.elevation_profile[route.elevation_profile.length - 1].distance_km 
    : 0;
  
  if (distanceKm > 0) {
    if (vehicle.range_km < distanceKm * 1.2) {
      const stops = Math.ceil(distanceKm / (vehicle.range_km * 0.8));
      warnings.push(`Range ${vehicle.range_km}km memerlukan ${stops}x isi bensin (jarak rute ~${distanceKm.toFixed(0)}km)`);
      score -= 1;
      recommendations.push(`Pastikan isi penuh di setiap SPBU yang dilewati`);
    } else {
      positives.push(`Range ${vehicle.range_km}km cukup untuk jarak rute ~${distanceKm.toFixed(0)}km`);
    }
  }

  // 4. Torsi vs gradient
  if (vehicle.torque_nm < 250 && route.max_gradient > 20) {
    criticals.push(`Torsi ${vehicle.torque_nm}Nm kurang ideal untuk tanjakan ${route.max_gradient.toFixed(1)}%`);
    score -= 2;
  } else if (vehicle.torque_nm < 300 && route.max_gradient > 15) {
    warnings.push(`Torsi ${vehicle.torque_nm}Nm perlu perhatian untuk tanjakan ${route.max_gradient.toFixed(1)}%`);
    score -= 1;
  } else if (vehicle.torque_nm >= 350) {
    positives.push(`Torsi ${vehicle.torque_nm}Nm memadai untuk tanjakan terjal`);
  }

  // 5. Wading depth vs sungai
  if (route.river_crossings > 0 && vehicle.wading_depth_mm < 400) {
    criticals.push(`Kedalaman wading ${vehicle.wading_depth_mm}mm berisiko untuk ${route.river_crossings} penyeberangan sungai`);
    score -= 3;
  } else if (route.river_crossings > 0 && vehicle.wading_depth_mm < 600) {
    warnings.push(`Wading depth ${vehicle.wading_depth_mm}mm perlu hati-hati saat menyeberang sungai`);
    score -= 1;
  } else if (vehicle.wading_depth_mm >= 600) {
    positives.push(`Wading depth ${vehicle.wading_depth_mm}mm aman untuk penyeberangan air`);
  }

  // 6. Risk level kendaraan
  if (vehicle.risk_level === "Very High") {
    criticals.push(`Risk level "Very High" — kendaraan ini sangat berisiko untuk perjalanan jauh`);
    score -= 3;
    recommendations.push(`Siapkan dana cadangan minimal Rp 50-100 juta untuk perbaikan darurat`);
  } else if (vehicle.risk_level === "High") {
    warnings.push(`Risk level "High" — kendaraan memerlukan persiapan ekstra dan dana cadangan`);
    score -= 2;
    recommendations.push(`Siapkan dana cadangan Rp 30-50 juta`);
  } else if (vehicle.risk_level === "Low") {
    positives.push(`Risk level "Low" — kendaraan andal untuk perjalanan jauh`);
  }

  // 7. Breakover angle untuk jalan bergelombang
  if (route.max_gradient > 20 && vehicle.breakover_angle < 18) {
    warnings.push(`Breakover angle ${vehicle.breakover_angle}° berisiko tersangkut di puncak tanjakan`);
    score -= 1;
  }

  // 8. Berat kendaraan vs tanjakan
  if (vehicle.weight_kg > 2300 && route.max_gradient > 18) {
    warnings.push(`Berat ${vehicle.weight_kg}kg bisa menyulitkan di tanjakan ${route.max_gradient.toFixed(1)}% (risiko selip/rem blong)`);
    score -= 1;
    recommendations.push(`Gunakan gigi rendah saat turunan, manfaatkan engine brake`);
  }

  // Rekomendasi umum
  if (route.total_ascent_m > 2000) {
    recommendations.push(`Total pendakian ${route.total_ascent_m.toFixed(0)}m — pastikan rem dalam kondisi prima`);
  }
  
  if (route.steep_segments.length > 3) {
    recommendations.push(`Terdapat ${route.steep_segments.length} segmen tanjakan curam — jaga jarak aman`);
  }

  if (vehicle.tire_type === "All-Terrain") {
    positives.push(`Ban All-Terrain cocok untuk kondisi jalan bervariasi`);
  }

  recommendations.push(`Bawa ban serep, dongkrak, dan peralatan darurat`);
  recommendations.push(`Pastikan kondisi fisik pengemudi prima untuk perjalanan jauh`);

  // Hitung estimasi biaya BBM
  const fuelNeeded = distanceKm / vehicle.fuel_consumption_km_per_l;
  const fuelCost = fuelNeeded * 13500; // harga solar ~Rp 13.500/liter
  const fuelStops = distanceKm > 0 ? Math.ceil(distanceKm / (vehicle.range_km * 0.8)) - 1 : 0;

  return {
    score: Math.max(1, Math.min(10, score)),
    warnings,
    criticals,
    positives,
    recommendations: [...new Set(recommendations)], // hapus duplikat
    verdict: score >= 8 ? "COCOK" : score >= 5 ? "PERHATIAN" : "TIDAK COCOK",
    estimated_fuel_cost: Math.round(fuelCost),
    estimated_fuel_stops: Math.max(0, fuelStops)
  };
}
