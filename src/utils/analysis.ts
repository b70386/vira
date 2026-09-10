import { Vehicle } from '../data/vehicles';
import { RouteAnalysis, FeasibilityResult, POI } from '../types';

/**
 * Feasibility scoring thresholds and penalties
 */
const SCORE = {
  base: 10,
  clearance: { critical: -3, warn: -1 },
  drivetrain: { critical: -4, warn: -2 },
  range: -1,
  torque: { critical: -2, warn: -1 },
  riskLevel: { veryHigh: -3, high: -2 },
  breakover: -1,
  weight: -1,
  spbu: { critical: -2, warn: -1 },
};

const THRESHOLDS = {
  clearance: { critical: 160, warn: 180, good: 200 },
  gradient: { crit: 20, warn: 15, alert: 12 },
  torque: { crit: 250, warn: 300, good: 350 },
  weight: { heavy: 2300, steepGrad: 18 },
  spbuGap: 0.7, // % of vehicle range
  breakover: 18,
  ascent: 2000,
  steepSegments: 3,
  fuelPrice: 13500, // Rp per liter (diesel)
};

interface ScoringContext {
  score: number;
  warnings: string[];
  criticals: string[];
  positives: string[];
  recommendations: string[];
}

/**
 * Evaluate vehicle feasibility for a given route
 */
export function analyzeFeasibility(
  vehicle: Vehicle,
  route: RouteAnalysis,
  pois: POI[] = []
): FeasibilityResult {
  const ctx: ScoringContext = {
    score: SCORE.base,
    warnings: [],
    criticals: [],
    positives: [],
    recommendations: [],
  };

  const distance = route.elevation_profile.length > 0
    ? route.elevation_profile[route.elevation_profile.length - 1].distance_km
    : 0;

  // Evaluate each dimension
  evalClearance(ctx, vehicle, route);
  evalDrivetrain(ctx, vehicle, route);
  evalRange(ctx, vehicle, distance);
  evalTorque(ctx, vehicle, route);
  evalRiskLevel(ctx, vehicle);
  evalBreakover(ctx, vehicle, route);
  evalWeight(ctx, vehicle, route);
  evalRouteConditions(ctx, route);
  evalSPBU(ctx, vehicle, route, pois);
  evalFuel(ctx, vehicle, distance);

  // Deduplicate recommendations and clamp score
  return {
    score: Math.max(1, Math.min(10, ctx.score)),
    warnings: ctx.warnings,
    criticals: ctx.criticals,
    positives: ctx.positives,
    recommendations: [...new Set(ctx.recommendations)],
    verdict:
      ctx.score >= 8 ? 'COCOK' : ctx.score >= 5 ? 'PERHATIAN' : 'TIDAK COCOK',
    estimated_fuel_cost: Math.round(
      (distance / vehicle.fuel_consumption_km_per_l) * THRESHOLDS.fuelPrice
    ),
    estimated_fuel_stops: Math.max(
      0,
      distance > 0 ? Math.ceil(distance / (vehicle.range_km * 0.8)) - 1 : 0
    ),
  };
}

function evalClearance(ctx: ScoringContext, vehicle: Vehicle, route: RouteAnalysis) {
  const { ground_clearance_mm } = vehicle;
  const { max_gradient } = route;

  if (ground_clearance_mm < THRESHOLDS.clearance.critical && max_gradient > THRESHOLDS.gradient.warn) {
    ctx.criticals.push(
      `Ground clearance ${ground_clearance_mm}mm terlalu rendah untuk tanjakan ${max_gradient.toFixed(
        1
      )}%`
    );
    ctx.score += SCORE.clearance.critical;
  } else if (
    ground_clearance_mm < THRESHOLDS.clearance.warn &&
    max_gradient > THRESHOLDS.gradient.alert
  ) {
    ctx.warnings.push(
      `Ground clearance ${ground_clearance_mm}mm perlu perhatian untuk tanjakan ${max_gradient.toFixed(
        1
      )}%`
    );
    ctx.score += SCORE.clearance.warn;
  } else if (ground_clearance_mm >= THRESHOLDS.clearance.good) {
    ctx.positives.push(
      `Ground clearance ${ground_clearance_mm}mm cukup untuk medan rute ini`
    );
  }
}

function evalDrivetrain(ctx: ScoringContext, vehicle: Vehicle, route: RouteAnalysis) {
  const is2WD = vehicle.drivetrain.includes('RWD') || vehicle.drivetrain.includes('FWD');

  if (is2WD && route.off_road_segments > 0) {
    ctx.criticals.push(
      `Kendaraan ${vehicle.drivetrain} tidak cocok untuk ${route.off_road_segments} segmen off-road`
    );
    ctx.score += SCORE.drivetrain.critical;
  } else if (is2WD && route.max_gradient > THRESHOLDS.gradient.warn) {
    ctx.warnings.push(
      `Kendaraan ${vehicle.drivetrain} akan kesulitan di tanjakan curam >15%`
    );
    ctx.score += SCORE.drivetrain.warn;
  } else if (!is2WD) {
    ctx.positives.push(
      `${vehicle.drivetrain} tersedia untuk menangani medan berat`
    );
  }
}

function evalRange(ctx: ScoringContext, vehicle: Vehicle, distance: number) {
  if (distance <= 0) return;

  if (vehicle.range_km < distance * 1.2) {
    const stops = Math.ceil(distance / (vehicle.range_km * 0.8));
    ctx.warnings.push(
      `Range ${vehicle.range_km}km memerlukan ${stops}x isi bensin (jarak rute ~${distance.toFixed(
        0
      )}km)`
    );
    ctx.score += SCORE.range;
    ctx.recommendations.push('Pastikan isi penuh di setiap SPBU yang dilewati');
  } else {
    ctx.positives.push(
      `Range ${vehicle.range_km}km cukup untuk jarak rute ~${distance.toFixed(0)}km`
    );
  }
}

function evalTorque(ctx: ScoringContext, vehicle: Vehicle, route: RouteAnalysis) {
  const { torque_nm } = vehicle;
  const { max_gradient } = route;

  if (torque_nm < THRESHOLDS.torque.crit && max_gradient > THRESHOLDS.gradient.crit) {
    ctx.criticals.push(
      `Torsi ${torque_nm}Nm kurang ideal untuk tanjakan ${max_gradient.toFixed(1)}%`
    );
    ctx.score += SCORE.torque.critical;
  } else if (torque_nm < THRESHOLDS.torque.warn && max_gradient > THRESHOLDS.gradient.warn) {
    ctx.warnings.push(
      `Torsi ${torque_nm}Nm perlu perhatian untuk tanjakan ${max_gradient.toFixed(1)}%`
    );
    ctx.score += SCORE.torque.warn;
  } else if (torque_nm >= THRESHOLDS.torque.good) {
    ctx.positives.push(`Torsi ${torque_nm}Nm memadai untuk tanjakan terjal`);
  }
}

function evalRiskLevel(ctx: ScoringContext, vehicle: Vehicle) {
  if (vehicle.risk_level === 'Very High') {
    ctx.criticals.push(
      'Risk level "Very High" — kendaraan ini sangat berisiko untuk perjalanan jauh'
    );
    ctx.score += SCORE.riskLevel.veryHigh;
    ctx.recommendations.push(
      'Siapkan dana cadangan minimal Rp 50-100 juta untuk perbaikan darurat'
    );
  } else if (vehicle.risk_level === 'High') {
    ctx.warnings.push(
      'Risk level "High" — kendaraan memerlukan persiapan ekstra dan dana cadangan'
    );
    ctx.score += SCORE.riskLevel.high;
    ctx.recommendations.push('Siapkan dana cadangan Rp 30-50 juta');
  } else if (vehicle.risk_level === 'Low') {
    ctx.positives.push(
      'Risk level "Low" — kendaraan andal untuk perjalanan jauh'
    );
  }
}

function evalBreakover(ctx: ScoringContext, vehicle: Vehicle, route: RouteAnalysis) {
  if (
    route.max_gradient > THRESHOLDS.gradient.crit &&
    vehicle.breakover_angle < THRESHOLDS.breakover
  ) {
    ctx.warnings.push(
      `Breakover angle ${vehicle.breakover_angle}° berisiko tersangkut di puncak tanjakan`
    );
    ctx.score += SCORE.breakover;
  }
}

function evalWeight(ctx: ScoringContext, vehicle: Vehicle, route: RouteAnalysis) {
  if (
    vehicle.weight_kg > THRESHOLDS.weight.heavy &&
    route.max_gradient > THRESHOLDS.weight.steepGrad
  ) {
    ctx.warnings.push(
      `Berat ${vehicle.weight_kg}kg bisa menyulitkan di tanjakan ${route.max_gradient.toFixed(
        1
      )}% (risiko selip/rem blong)`
    );
    ctx.score += SCORE.weight;
    ctx.recommendations.push(
      'Gunakan gigi rendah saat turunan, manfaatkan engine brake'
    );
  }
}

function evalRouteConditions(ctx: ScoringContext, route: RouteAnalysis) {
  if (route.total_ascent_m > THRESHOLDS.ascent) {
    ctx.recommendations.push(
      `Total pendakian ${route.total_ascent_m.toFixed(0)}m — pastikan rem dalam kondisi prima`
    );
  }

  if (route.steep_segments.length > THRESHOLDS.steepSegments) {
    ctx.recommendations.push(
      `Terdapat ${route.steep_segments.length} segmen tanjakan curam — jaga jarak aman`
    );
  }
}

function evalSPBU(
  ctx: ScoringContext,
  vehicle: Vehicle,
  route: RouteAnalysis,
  pois: POI[]
) {
  const distance = route.elevation_profile.length > 0
    ? route.elevation_profile[route.elevation_profile.length - 1].distance_km
    : 0;

  if (distance <= 0 || pois.length === 0) return;

  const spbuList = pois.filter((p) => p.type === 'spbu');

  if (spbuList.length === 0) {
    ctx.criticals.push(
      `Tidak ada SPBU terdeteksi di sepanjang rute (${distance.toFixed(
        0
      )}km) — sangat berisiko!`
    );
    ctx.score += SCORE.spbu.critical;
    ctx.recommendations.push(
      'WAJIB isi penuh sebelum berangkat dan bawa jerigen cadangan'
    );
    return;
  }

  // Find largest gap between gas stations
  const dist = spbuList.map((s) => s.distance_from_start_km).sort((a, b) => a - b);
  let maxGap = dist[0]; // Gap from start
  let gapStart = 0;

  for (let i = 1; i < dist.length; i++) {
    const gap = dist[i] - dist[i - 1];
    if (gap > maxGap) {
      maxGap = gap;
      gapStart = dist[i - 1];
    }
  }

  // Gap from last station to end
  const lastGap = distance - dist[dist.length - 1];
  if (lastGap > maxGap) {
    maxGap = lastGap;
    gapStart = dist[dist.length - 1];
  }

  if (maxGap > vehicle.range_km * THRESHOLDS.spbuGap) {
    ctx.warnings.push(
      `Jarak terjauh antar SPBU: ${maxGap.toFixed(0)}km (KM ${gapStart.toFixed(
        0
      )}-${(gapStart + maxGap).toFixed(0)}) — melebihi 70% range kendaraan`
    );
    ctx.score += SCORE.spbu.warn;
    ctx.recommendations.push(
      `Isi penuh tangki di SPBU KM ${gapStart.toFixed(
        0
      )} dan pertimbangkan bawa jerigen cadangan`
    );
  } else {
    ctx.positives.push(`SPBU tersedia cukup merata — jarak terjauh ${maxGap.toFixed(0)}km`);
  }
}

function evalFuel(ctx: ScoringContext, vehicle: Vehicle, distance: number) {
  if (distance > 0) {
    ctx.recommendations.push('Bawa ban serep, dongkrak, dan peralatan darurat');
    ctx.recommendations.push(
      'Pastikan kondisi fisik pengemudi prima untuk perjalanan jauh'
    );
  }
}
