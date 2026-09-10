// Analisis kondisi khusus kendaraan berdasarkan input manual user
// Menggunakan keyword matching untuk mendeteksi masalah umum

export interface ConditionAnalysis {
  warnings: string[];
  criticals: string[];
  recommendations: string[];
  scorePenalty: number;
}

// Database keyword dan dampaknya
interface ConditionRule {
  keywords: string[];
  severity: 'warning' | 'critical';
  message: string;
  recommendation: string;
  scorePenalty: number;
}

const CONDITION_RULES: ConditionRule[] = [
  // === REM ===
  {
    keywords: ['kampas rem', 'rem tipis', 'rem habis', 'brake pad'],
    severity: 'critical',
    message: 'Kampas rem tipis/habis — sangat berbahaya untuk turunan curam',
    recommendation: 'WAJIB ganti kampas rem sebelum perjalanan, terutama untuk rute dengan tanjakan/turunan',
    scorePenalty: 3
  },
  {
    keywords: ['rem blong', 'rem tidak pakem', 'rem makan dalam', 'rem bohong'],
    severity: 'critical',
    message: 'Sistem rem bermasalah — risiko kecelakaan sangat tinggi',
    recommendation: 'JANGAN lanjutkan perjalanan sebelum rem diperbaiki total',
    scorePenalty: 5
  },
  {
    keywords: ['rem tangan', 'handbrake', 'rem parkir'],
    severity: 'warning',
    message: 'Rem tangan bermasalah — berbahaya saat parkir di tanjakan',
    recommendation: 'Perbaiki rem tangan dan ganjal ban saat parkir di tanjakan',
    scorePenalty: 1
  },
  {
    keywords: ['disk brake', 'piringan rem', 'cakram'],
    severity: 'warning',
    message: 'Masalah pada sistem pengereman',
    recommendation: 'Periksa dan perbaiki sistem rem sebelum perjalanan jauh',
    scorePenalty: 2
  },

  // === BAN ===
  {
    keywords: ['ban tipis', 'ban gundul', 'ban habis', 'ban botak'],
    severity: 'critical',
    message: 'Ban tipis/gundul — risiko pecah ban sangat tinggi, terutama di jalan panas',
    recommendation: 'Ganti ban sebelum perjalanan, minimal kedalaman alur 1.6mm',
    scorePenalty: 3
  },
  {
    keywords: ['ban benjol', 'ban tonjolan', 'ban rusak'],
    severity: 'critical',
    message: 'Ban benjol — risiko pecah ban mendadak',
    recommendation: 'SEGERA ganti ban, jangan dipaksakan perjalanan jauh',
    scorePenalty: 4
  },
  {
    keywords: ['ban serep', 'serep tidak ada', 'tanpa serep'],
    severity: 'warning',
    message: 'Ban serep tidak tersedia/bermasalah',
    recommendation: 'Pastikan ban serep dalam kondisi baik dan tersedia sebelum perjalanan',
    scorePenalty: 1
  },
  {
    keywords: ['ban lama', 'ban tua', 'ban 3 tahun', 'ban 4 tahun', 'ban 5 tahun'],
    severity: 'warning',
    message: 'Ban sudah berumur — karet mengeras, traksi berkurang',
    recommendation: 'Pertimbangkan ganti ban, terutama untuk rute dengan banyak tikungan',
    scorePenalty: 1
  },
  {
    keywords: ['tekanan ban', 'angin ban', 'ban kempes'],
    severity: 'warning',
    message: 'Masalah tekanan ban',
    recommendation: 'Cek dan sesuaikan tekanan ban sebelum perjalanan',
    scorePenalty: 1
  },

  // === STEERING / SUSPENSI ===
  {
    keywords: ['oleng', 'stir oleng', 'setir oleng', 'tarik ke'],
    severity: 'warning',
    message: 'Steering tidak stabil — bisa berbahaya di jalan berkelok',
    recommendation: 'Lakukan spooring & balancing sebelum perjalanan',
    scorePenalty: 2
  },
  {
    keywords: ['bocor halus', 'power steering bocor', 'oli power steering'],
    severity: 'warning',
    message: 'Sistem power steering bermasalah',
    recommendation: 'Periksa dan perbaiki sistem power steering',
    scorePenalty: 2
  },
  {
    keywords: ['kaki-kaki', 'kaki kaki', 'bushing', 'ball joint', 'tie rod'],
    severity: 'warning',
    message: 'Kaki-kaki bermasalah — kenyamanan dan keamanan berkurang',
    recommendation: 'Periksa dan ganti komponen kaki-kaki yang aus',
    scorePenalty: 2
  },
  {
    keywords: ['shockbreaker', 'shock breaker', 'shockbreker', 'per'],
    severity: 'warning',
    message: 'Shockbreaker bermasalah — handling di jalan rusak tidak optimal',
    recommendation: 'Ganti shockbreaker yang sudah lemah/bocor',
    scorePenalty: 2
  },
  {
    keywords: ['bunyi gluduk', 'bunyi tek tek', 'bunyi di kaki'],
    severity: 'warning',
    message: 'Ada bunyi abnormal di kaki-kaki',
    recommendation: 'Periksa komponen suspensi dan steering sebelum perjalanan',
    scorePenalty: 1
  },

  // === MESIN ===
  {
    keywords: ['overheat', 'panas berlebih', 'suhu naik', 'mesin panas'],
    severity: 'critical',
    message: 'Mesin mudah overheat — risiko kerusakan mesin fatal di tanjakan',
    recommendation: 'Periksa radiator, thermostat, dan kipas. JANGAN lanjutkan jika masih overheat',
    scorePenalty: 4
  },
  {
    keywords: ['radiator', 'air radiator', 'coolant'],
    severity: 'warning',
    message: 'Masalah sistem pendingin',
    recommendation: 'Periksa dan isi ulang coolant, cek kebocoran radiator',
    scorePenalty: 2
  },
  {
    keywords: ['turbo', 'turbo bocor', 'turbo lemah', 'boost'],
    severity: 'warning',
    message: 'Turbo bermasalah — tenaga berkurang terutama di ketinggian',
    recommendation: 'Periksa turbo dan intercooler sebelum perjalanan',
    scorePenalty: 2
  },
  {
    keywords: ['mesin mati', 'mogok', 'sulit hidup', 'susah start'],
    severity: 'critical',
    message: 'Mesin tidak stabil — risiko mogok di tengah perjalanan',
    recommendation: 'Diagnosa masalah mesin sebelum perjalanan jauh',
    scorePenalty: 3
  },
  {
    keywords: ['oli mesin', 'oli kurang', 'oli rembes', 'oli bocor'],
    severity: 'warning',
    message: 'Masalah oli mesin',
    recommendation: 'Periksa level oli dan perbaiki kebocoran sebelum perjalanan',
    scorePenalty: 2
  },
  {
    keywords: ['aki', 'accu', 'aki lemah', 'aki soak'],
    severity: 'warning',
    message: 'Aki bermasalah — risiko mobil tidak bisa dinyalakan',
    recommendation: 'Ganti aki atau bawa jumper cable darurat',
    scorePenalty: 1
  },
  {
    keywords: ['busi', 'spark plug'],
    severity: 'warning',
    message: 'Busi bermasalah — pembakaran tidak sempurna',
    recommendation: 'Ganti busi sebelum perjalanan',
    scorePenalty: 1
  },
  {
    keywords: ['timing belt', 'timing chain'],
    severity: 'critical',
    message: 'Timing belt/chain perlu perhatian — risiko putus = mesin jebol',
    recommendation: 'Ganti timing belt sesuai jadwal (biasanya per 100.000km)',
    scorePenalty: 3
  },

  // === TRANSMISI ===
  {
    keywords: ['transisi', 'operan kasar', 'gigi susah', 'transmisi'],
    severity: 'warning',
    message: 'Transmisi bermasalah — bisa menyulitkan di tanjakan',
    recommendation: 'Periksa oli transmisi dan kondisi kopling',
    scorePenalty: 2
  },
  {
    keywords: ['kopling', 'slip kopling', 'kopling habis'],
    severity: 'critical',
    message: 'Kopling bermasalah — tidak bisa menanjak dengan baik',
    recommendation: 'Ganti kopling sebelum perjalanan, terutama untuk rute pegunungan',
    scorePenalty: 3
  },
  {
    keywords: ['garden', 'gardan', 'differential'],
    severity: 'warning',
    message: 'Gardan bermasalah',
    recommendation: 'Periksa oli gardan dan kondisi bearing',
    scorePenalty: 2
  },

  // === LISTRIK ===
  {
    keywords: ['lampu mati', 'lampu tidak nyala', 'headlamp'],
    severity: 'warning',
    message: 'Lampu bermasalah — berbahaya untuk perjalanan malam',
    recommendation: 'Perbaiki sistem lampu sebelum perjalanan',
    scorePenalty: 1
  },
  {
    keywords: ['wiper', 'wiper mati', 'karet wiper'],
    severity: 'warning',
    message: 'Wiper bermasalah — berbahaya saat hujan',
    recommendation: 'Ganti karet wiper dan periksa motor wiper',
    scorePenalty: 1
  },

  // === BODI / LAINNYA ===
  {
    keywords: ['karat', 'korosi', 'body keropos'],
    severity: 'warning',
    message: 'Karat pada bodi/rangka — integritas struktur berkurang',
    recommendation: 'Periksa area karat, terutama rangka dan titik-titik struktural',
    scorePenalty: 1
  },
  {
    keywords: ['ac tidak dingin', 'ac mati', 'ac bermasalah', 'ac panas'],
    severity: 'warning',
    message: 'AC tidak berfungsi — pengemudi cepat lelah di cuaca panas',
    recommendation: 'Perbaiki AC atau pastikan ventilasi cukup',
    scorePenalty: 1
  },
  {
    keywords: ['bensin bocor', 'solar bocor', 'tangki bocor', 'fuel bocor'],
    severity: 'critical',
    message: 'Kebocoran bahan bakar — risiko kebakaran sangat tinggi',
    recommendation: 'JANGAN jalankan kendaraan sebelum kebocoran diperbaiki',
    scorePenalty: 5
  },
  {
    keywords: ['knalpot', 'knalpot bocor', 'gas buang'],
    severity: 'warning',
    message: 'Knalpot bermasalah — risiko gas masuk kabin',
    recommendation: 'Perbaiki kebocoran knalpot sebelum perjalanan',
    scorePenalty: 1
  }
];

/**
 * Analisis kondisi khusus kendaraan berdasarkan text input user
 */
export function analyzeSpecialConditions(text: string): ConditionAnalysis {
  if (!text || text.trim().length === 0) {
    return {
      warnings: [],
      criticals: [],
      recommendations: [],
      scorePenalty: 0
    };
  }

  const textLower = text.toLowerCase();
  const warnings: string[] = [];
  const criticals: string[] = [];
  const recommendations: string[] = [];
  let totalPenalty = 0;
  const matchedRules = new Set<string>(); // hindari duplikasi

  for (const rule of CONDITION_RULES) {
    // Cek apakah ada keyword yang match
    const matched = rule.keywords.some(keyword => textLower.includes(keyword.toLowerCase()));
    
    if (matched && !matchedRules.has(rule.message)) {
      matchedRules.add(rule.message);
      
      if (rule.severity === 'critical') {
        criticals.push(rule.message);
      } else {
        warnings.push(rule.message);
      }
      
      recommendations.push(rule.recommendation);
      totalPenalty += rule.scorePenalty;
    }
  }

  // Jika ada text tapi tidak ada yang match, beri catatan umum
  if (matchedRules.size === 0 && text.trim().length > 0) {
    warnings.push(`Catatan kondisi khusus: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
    recommendations.push('Pastikan kondisi di atas sudah diperbaiki atau dipertimbangkan sebelum perjalanan');
    totalPenalty += 1;
  }

  return {
    warnings,
    criticals,
    recommendations,
    scorePenalty: totalPenalty
  };
}
