import { useState, useEffect, useRef } from 'react';
import { searchLocation } from '../utils/routing';
import { Waypoint } from '../types';

interface SearchItem {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface RouteInputProps {
  waypoints: (Waypoint | null)[];
  onWaypointChange: (index: number, location: Waypoint | null) => void;
  onSubmit: () => void;
  isLoading: boolean;
  canAnalyze: boolean;
}

// Konfigurasi warna dan label untuk setiap waypoint
const WAYPOINT_CONFIG = [
  { label: 'A', color: 'green', emoji: '📍', title: 'Lokasi Asal', placeholder: 'Contoh: Manado, Jakarta...' },
  { label: 'B', color: 'blue', emoji: '📌', title: 'Tujuan 1 (Opsional)', placeholder: 'Contoh: Gorontalo, Bogor...' },
  { label: 'C', color: 'purple', emoji: '📌', title: 'Tujuan 2 (Opsional)', placeholder: 'Contoh: Palu, Semarang...' },
  { label: 'D', color: 'red', emoji: '🏁', title: 'Tujuan Akhir', placeholder: 'Contoh: Makassar, Surabaya...' },
];

const COLOR_MAP: Record<string, { bg: string; text: string; ring: string; border: string; marker: string }> = {
  green: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-300', ring: 'ring-green-200 dark:ring-green-800', border: 'border-green-500', marker: 'bg-green-500' },
  blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-300', ring: 'ring-blue-200 dark:ring-blue-800', border: 'border-blue-500', marker: 'bg-blue-500' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-700 dark:text-purple-300', ring: 'ring-purple-200 dark:ring-purple-800', border: 'border-purple-500', marker: 'bg-purple-500' },
  red: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-300', ring: 'ring-red-200 dark:ring-red-800', border: 'border-red-500', marker: 'bg-red-500' },
};

export default function RouteInput({ waypoints, onWaypointChange, onSubmit, isLoading, canAnalyze }: RouteInputProps) {
  const [queries, setQueries] = useState<string[]>(['', '', '', '']);
  const [results, setResults] = useState<SearchItem[][]>([[], [], [], []]);
  const [showResults, setShowResults] = useState<boolean[]>([false, false, false, false]);
  const timeoutRefs = useRef<(ReturnType<typeof setTimeout> | null)[]>([null, null, null, null]);

  // Debounce search untuk setiap waypoint
  useEffect(() => {
    queries.forEach((query, index) => {
      if (query.length < 3) {
        setResults(prev => {
          const updated = [...prev];
          updated[index] = [];
          return updated;
        });
        return;
      }

      if (timeoutRefs.current[index]) clearTimeout(timeoutRefs.current[index]!);
      
      timeoutRefs.current[index] = setTimeout(async () => {
        try {
          const searchResults = await searchLocation(query);
          setResults(prev => {
            const updated = [...prev];
            updated[index] = searchResults;
            return updated;
          });
          setShowResults(prev => {
            const updated = [...prev];
            updated[index] = true;
            return updated;
          });
        } catch (error) {
          console.error('Error searching location:', error);
        }
      }, 500);
    });

    return () => {
      timeoutRefs.current.forEach(t => { if (t) clearTimeout(t); });
    };
  }, [queries]);

  const handleSelect = (index: number, result: SearchItem) => {
    const config = WAYPOINT_CONFIG[index];
    const shortName = result.display_name.split(',').slice(0, 2).join(', ');
    
    setQueries(prev => {
      const updated = [...prev];
      updated[index] = shortName;
      return updated;
    });
    
    onWaypointChange(index, {
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      name: result.display_name,
      label: config.label
    });
    
    setShowResults(prev => {
      const updated = [...prev];
      updated[index] = false;
      return updated;
    });
  };

  const handleRemoveWaypoint = (index: number) => {
    if (index === 0 || index === 3) return; // Tidak bisa hapus asal dan tujuan akhir
    setQueries(prev => {
      const updated = [...prev];
      updated[index] = '';
      return updated;
    });
    onWaypointChange(index, null);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 border border-gray-200 dark:border-gray-700">
      <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
        <span className="text-2xl">🗺️</span> Input Rute
        <span className="text-xs font-normal text-gray-400 dark:text-gray-500 ml-auto">
          {waypoints.filter(w => w !== null).length}/4 titik
        </span>
      </h2>
      
      <div className="space-y-3">
        {WAYPOINT_CONFIG.map((config, index) => {
          const colors = COLOR_MAP[config.color];
          const isOptional = index === 1 || index === 2;
          const hasValue = waypoints[index] !== null;
          
          return (
            <div key={index} className="relative">
              <div className={`flex items-center gap-2 mb-1`}>
                <span className={`w-6 h-6 ${colors.marker} text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-sm`}>
                  {config.label}
                </span>
                <label className={`text-sm font-medium ${colors.text}`}>
                  {config.title}
                </label>
                {isOptional && hasValue && (
                  <button
                    onClick={() => handleRemoveWaypoint(index)}
                    className="ml-auto text-xs text-gray-400 hover:text-red-500 transition-colors"
                    title="Hapus waypoint"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={queries[index]}
                    onChange={(e) => {
                      const updated = [...queries];
                      updated[index] = e.target.value;
                      setQueries(updated);
                      // Reset waypoint jika user mulai mengetik ulang
                      if (waypoints[index]) {
                        onWaypointChange(index, null);
                      }
                    }}
                    onFocus={() => results[index].length > 0 && setShowResults(prev => {
                      const updated = [...prev];
                      updated[index] = true;
                      return updated;
                    })}
                    onBlur={() => setTimeout(() => setShowResults(prev => {
                      const updated = [...prev];
                      updated[index] = false;
                      return updated;
                    }), 200)}
                    placeholder={config.placeholder}
                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-400 text-sm transition-all ${
                      hasValue 
                        ? `${colors.border} border-2` 
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                  {hasValue && (
                    <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs ${colors.text}`}>
                      ✓
                    </span>
                  )}
                  {showResults[index] && results[index].length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {results[index].map((result) => (
                        <button
                          key={result.place_id}
                          onClick={() => handleSelect(index, result)}
                          className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-gray-600 text-sm text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-600 last:border-0"
                        >
                          {result.display_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Connector line antar waypoint */}
              {index < 3 && (
                <div className="flex justify-center py-1">
                  <div className={`w-0.5 h-3 ${index < (waypoints.findIndex((w, i) => i > index && w === null) === -1 ? index + 1 : waypoints.findIndex((w, i) => i > index && w === null)) - 1 ? 'bg-gray-300 dark:bg-gray-600' : 'bg-gray-200 dark:bg-gray-700'}`}></div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Start - Contoh Rute */}
      <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">🏁 Contoh rute populer:</p>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => {
              setQueries(['Manado', 'Gorontalo', 'Palu', 'Makassar']);
              onWaypointChange(0, { lat: 1.4748, lng: 124.8421, name: 'Manado, Sulawesi Utara, Indonesia', label: 'A' });
              onWaypointChange(1, { lat: 0.5435, lng: 123.0568, name: 'Gorontalo, Indonesia', label: 'B' });
              onWaypointChange(2, { lat: -0.8952, lng: 119.8586, name: 'Palu, Sulawesi Tengah, Indonesia', label: 'C' });
              onWaypointChange(3, { lat: -5.1477, lng: 119.4327, name: 'Makassar, Sulawesi Selatan, Indonesia', label: 'D' });
            }}
            className="text-xs px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
          >
            Trans Sulawesi
          </button>
          <button
            onClick={() => {
              setQueries(['Jakarta', 'Bogor', 'Bandung', '']);
              onWaypointChange(0, { lat: -6.2088, lng: 106.8456, name: 'Jakarta, Indonesia', label: 'A' });
              onWaypointChange(1, { lat: -6.5971, lng: 106.8060, name: 'Bogor, Jawa Barat, Indonesia', label: 'B' });
              onWaypointChange(2, { lat: -6.9175, lng: 107.6191, name: 'Bandung, Jawa Barat, Indonesia', label: 'C' });
              onWaypointChange(3, null);
            }}
            className="text-xs px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
          >
            Jakarta → Bandung
          </button>
          <button
            onClick={() => {
              setQueries(['Medan', 'Berastagi', 'Parapat', '']);
              onWaypointChange(0, { lat: 3.5952, lng: 98.6722, name: 'Medan, Sumatera Utara, Indonesia', label: 'A' });
              onWaypointChange(1, { lat: 3.2167, lng: 98.5167, name: 'Berastagi, Karo, Indonesia', label: 'B' });
              onWaypointChange(2, { lat: 2.6617, lng: 98.8850, name: 'Parapat, Sumatera Utara, Indonesia', label: 'C' });
              onWaypointChange(3, null);
            }}
            className="text-xs px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
          >
            Medan → Danau Toba
          </button>
          <button
            onClick={() => {
              setQueries(['Surabaya', 'Malang', 'Batu', '']);
              onWaypointChange(0, { lat: -7.2575, lng: 112.7521, name: 'Surabaya, Jawa Timur, Indonesia', label: 'A' });
              onWaypointChange(1, { lat: -7.9786, lng: 112.6317, name: 'Malang, Jawa Timur, Indonesia', label: 'B' });
              onWaypointChange(2, { lat: -7.8696, lng: 112.5251, name: 'Batu, Jawa Timur, Indonesia', label: 'C' });
              onWaypointChange(3, null);
            }}
            className="text-xs px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
          >
            Surabaya → Batu
          </button>
        </div>
      </div>

      {/* Tombol Submit */}
      <button
        onClick={onSubmit}
        disabled={isLoading || !canAnalyze}
        className="w-full mt-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-lg shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Menganalisis Rute...
          </>
        ) : (
          <>
            <span>🚀</span> Analisis Rute
          </>
        )}
      </button>
      
      {!canAnalyze && !isLoading && (
        <p className="text-xs text-center text-gray-400 dark:text-gray-500 mt-2">
          Isi minimal 2 lokasi & pilih kendaraan untuk mulai analisis
        </p>
      )}
    </div>
  );
}
