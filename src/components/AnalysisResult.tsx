import { FeasibilityResult, RouteAnalysis } from '../types';
import { Vehicle } from '../data/vehicles';

interface AnalysisResultProps {
  result: FeasibilityResult | null;
  routeAnalysis: RouteAnalysis | null;
  vehicle: Vehicle | null;
  distanceKm: number;
  durationMinutes: number;
}

export default function AnalysisResult({ result, routeAnalysis, vehicle, distanceKm, durationMinutes }: AnalysisResultProps) {
  if (!result || !routeAnalysis || !vehicle) return null;

  const getVerdictStyle = (verdict: string) => {
    switch (verdict) {
      case 'COCOK': return 'bg-green-100 dark:bg-green-900/40 border-green-500 text-green-800 dark:text-green-200';
      case 'PERHATIAN': return 'bg-yellow-100 dark:bg-yellow-900/40 border-yellow-500 text-yellow-800 dark:text-yellow-200';
      case 'TIDAK COCOK': return 'bg-red-100 dark:bg-red-900/40 border-red-500 text-red-800 dark:text-red-200';
      default: return 'bg-gray-100 border-gray-500 text-gray-800';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600 dark:text-green-400';
    if (score >= 5) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreBg = (score: number) => {
    if (score >= 8) return 'from-green-400 to-green-600';
    if (score >= 5) return 'from-yellow-400 to-yellow-600';
    return 'from-red-400 to-red-600';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header dengan Skor */}
      <div className={`p-5 border-b-4 ${getVerdictStyle(result.verdict)}`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Hasil Analisis Kelayakan</h2>
            <p className="text-sm opacity-80 mt-1">{vehicle.name}</p>
          </div>
          <div className="text-center">
            <div className={`text-4xl font-black bg-gradient-to-r ${getScoreBg(result.score)} bg-clip-text text-transparent`}>
              {result.score}
            </div>
            <div className="text-xs font-medium opacity-70">/10</div>
          </div>
        </div>
        
        <div className={`mt-3 inline-block px-4 py-1.5 rounded-full font-bold text-sm border ${getVerdictStyle(result.verdict)}`}>
          {result.verdict === 'COCOK' && '✅ '}
          {result.verdict === 'PERHATIAN' && '⚠️ '}
          {result.verdict === 'TIDAK COCOK' && '❌ '}
          STATUS: {result.verdict}
        </div>
      </div>

      {/* Info Rute */}
      <div className="p-5 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-3">📊 Data Rute</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-gray-800 dark:text-white">{distanceKm.toFixed(0)} km</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Jarak</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-gray-800 dark:text-white">{routeAnalysis.total_ascent_m.toFixed(0)} m</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Total Naik</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-gray-800 dark:text-white">{routeAnalysis.max_gradient.toFixed(1)}%</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Max Gradient</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-gray-800 dark:text-white">{(durationMinutes / 60).toFixed(1)} jam</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Estimasi Waktu</div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-gray-800 dark:text-white">{routeAnalysis.max_elevation_m.toFixed(0)} m</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Elevasi Max</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-gray-800 dark:text-white">{routeAnalysis.steep_segments.length}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Tanjakan &gt;10%</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-gray-800 dark:text-white">Rp {(result.estimated_fuel_cost / 1000).toFixed(0)}rb</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Est. BBM</div>
          </div>
        </div>
      </div>

      {/* Detail Analisis */}
      <div className="p-5 space-y-4">
        {/* Positif */}
        {result.positives.length > 0 && (
          <div>
            <h3 className="font-semibold text-green-700 dark:text-green-400 mb-2 flex items-center gap-1">
              ✅ Keunggulan
            </h3>
            <ul className="space-y-1">
              {result.positives.map((item, i) => (
                <li key={i} className="text-sm text-gray-600 dark:text-gray-300 flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Warnings */}
        {result.warnings.length > 0 && (
          <div>
            <h3 className="font-semibold text-yellow-700 dark:text-yellow-400 mb-2 flex items-center gap-1">
              ⚠️ Perhatian
            </h3>
            <ul className="space-y-1">
              {result.warnings.map((item, i) => (
                <li key={i} className="text-sm text-gray-600 dark:text-gray-300 flex items-start gap-2">
                  <span className="text-yellow-500 mt-0.5">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Criticals */}
        {result.criticals.length > 0 && (
          <div>
            <h3 className="font-semibold text-red-700 dark:text-red-400 mb-2 flex items-center gap-1">
              ❌ Risiko Kritis
            </h3>
            <ul className="space-y-1">
              {result.criticals.map((item, i) => (
                <li key={i} className="text-sm text-gray-600 dark:text-gray-300 flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Rekomendasi */}
        <div>
          <h3 className="font-semibold text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-1">
            💡 Rekomendasi
          </h3>
          <ul className="space-y-1">
            {result.recommendations.map((item, i) => (
              <li key={i} className="text-sm text-gray-600 dark:text-gray-300 flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">→</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
