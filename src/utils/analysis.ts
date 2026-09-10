// Logika analisis kelayakan kendaraan untuk rute tertentu
import { Vehicle } from '../data/vehicles';
import { RouteAnalysis, FeasibilityResult, POI } from '../types';

/**
 * Analisis kelayakan kendaraan untuk rute tertentu
 * Membandingkan spesifikasi kendaraan dengan kondisi medan rute
 */
export function analyzeFeasibility(vehicle: Vehicle, route: RouteAnalysis, pois: POI[] = []): FeasibilityResult {
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

  // 5. Wading depth - tidak lagi digunakan karena estimasi sungai tidak akurat
  // Mayoritas rute di Indonesia sudah memiliki jembatan
  // Wading depth hanya relevan untuk rute off-road spesifik yang tidak terdeteksi dari data rute

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

  // 9. Analisis ketersediaan SPBU di sepanjang rute
  if (distanceKm > 0 && pois.length > 0) {
    const spbuList = pois.filter(p => p.type === 'spbu');
    
    if (spbuList.length === 0) {
      criticals.push(`Tidak ada SPBU terdeteksi di sepanjang rute (${distanceKm.toFixed(0)}km) — sangat berisiko!`);
      score -= 2;
      recommendations.push(`WAJIB isi penuh sebelum berangkat dan bawa jerigen cadangan`);
    } else {
      // Cek jarak antar SPBU
      const spbuDistances = spbuList.map(s => s.distance_from_start_km).sort((a, b) => a - b);
      let maxGap = 0;
      let maxGapStart = 0;
      
      for (let i = 1; i < spbuDistances.length; i++) {
        const gap = spbuDistances[i] - spbuDistances[i - 1];
        if (gap > maxGap) {
          maxGap = gap;
          maxGapStart = spbuDistances[i - 1];
        }
      }
      
      // Cek gap dari start ke SPBU pertama
      if (spbuDistances[0] > maxGap) {
        maxGap = spbuDistances[0];
        maxGapStart = 0;
      }
      
      // Cek gap dari SPBU terakhir ke end
      const lastGap = distanceKm - spbuDistances[spbuDistances.length - 1];
      if (lastGap > maxGap) {
        maxGap = lastGap;
        maxGapStart = spbuDistances[spbuDistances.length - 1];
      }
      
      if (maxGap > vehicle.range_km * 0.7) {
        warnings.push(`Jarak terjauh antar SPBU: ${maxGap.toFixed(0)}km (KM ${maxGapStart.toFixed(0)}-${(maxGapStart + maxGap).toFixed(0)}) — melebihi 70% range kendaraan`);
        score -= 1;
        recommendations.push(`Isi penuh tangki di SPBU KM ${maxGapStart.toFixed(0)} dan pertimbangkan bawa jerigen cadangan`);
      } else {
        positives.push(`SPBU tersedia cukup merata — jarak terjauh ${maxGap.toFixed(0)}km`);
      }
    }
  }

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
