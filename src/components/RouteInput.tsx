import { useState, useEffect, useRef } from 'react';
import { searchLocation } from '../utils/routing';

interface SearchItem {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface RouteInputProps {
  onStartChange: (location: { lat: number; lng: number; name: string } | null) => void;
  onEndChange: (location: { lat: number; lng: number; name: string } | null) => void;
  onSubmit: () => void;
  isLoading: boolean;
}

export default function RouteInput({ onStartChange, onEndChange, onSubmit, isLoading }: RouteInputProps) {
  const [startQuery, setStartQuery] = useState('');
  const [endQuery, setEndQuery] = useState('');
  const [startResults, setStartResults] = useState<SearchItem[]>([]);
  const [endResults, setEndResults] = useState<SearchItem[]>([]);
  const [showStartResults, setShowStartResults] = useState(false);
  const [showEndResults, setShowEndResults] = useState(false);
  const startTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const endTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounce search untuk lokasi asal
  useEffect(() => {
    if (startQuery.length < 3) {
      setStartResults([]);
      return;
    }

    if (startTimeoutRef.current) clearTimeout(startTimeoutRef.current);
    
    startTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchLocation(startQuery);
        setStartResults(results);
        setShowStartResults(true);
      } catch (error) {
        console.error('Error searching location:', error);
      }
    }, 500);

    return () => {
      if (startTimeoutRef.current) clearTimeout(startTimeoutRef.current);
    };
  }, [startQuery]);

  // Debounce search untuk lokasi tujuan
  useEffect(() => {
    if (endQuery.length < 3) {
      setEndResults([]);
      return;
    }

    if (endTimeoutRef.current) clearTimeout(endTimeoutRef.current);
    
    endTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchLocation(endQuery);
        setEndResults(results);
        setShowEndResults(true);
      } catch (error) {
        console.error('Error searching location:', error);
      }
    }, 500);

    return () => {
      if (endTimeoutRef.current) clearTimeout(endTimeoutRef.current);
    };
  }, [endQuery]);

  const handleSelectStart = (result: SearchItem) => {
    setStartQuery(result.display_name.split(',').slice(0, 2).join(', '));
    onStartChange({ lat: parseFloat(result.lat), lng: parseFloat(result.lon), name: result.display_name });
    setShowStartResults(false);
  };

  const handleSelectEnd = (result: SearchItem) => {
    setEndQuery(result.display_name.split(',').slice(0, 2).join(', '));
    onEndChange({ lat: parseFloat(result.lat), lng: parseFloat(result.lon), name: result.display_name });
    setShowEndResults(false);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 border border-gray-200 dark:border-gray-700">
      <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
        <span className="text-2xl">🗺️</span> Input Rute
      </h2>
      
      <div className="space-y-4">
        {/* Input Asal */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
            📍 Lokasi Asal
          </label>
          <input
            type="text"
            value={startQuery}
            onChange={(e) => setStartQuery(e.target.value)}
            onFocus={() => startResults.length > 0 && setShowStartResults(true)}
            onBlur={() => setTimeout(() => setShowStartResults(false), 200)}
            placeholder="Contoh: Manado, Jakarta, Surabaya..."
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-400"
          />
          {showStartResults && startResults.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {startResults.map((result) => (
                <button
                  key={result.place_id}
                  onClick={() => handleSelectStart(result)}
                  className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-gray-600 text-sm text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-600 last:border-0"
                >
                  {result.display_name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Input Tujuan */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
            🏁 Lokasi Tujuan
          </label>
          <input
            type="text"
            value={endQuery}
            onChange={(e) => setEndQuery(e.target.value)}
            onFocus={() => endResults.length > 0 && setShowEndResults(true)}
            onBlur={() => setTimeout(() => setShowEndResults(false), 200)}
            placeholder="Contoh: Gorontalo, Bandung, Malang..."
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-400"
          />
          {showEndResults && endResults.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {endResults.map((result) => (
                <button
                  key={result.place_id}
                  onClick={() => handleSelectEnd(result)}
                  className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-gray-600 text-sm text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-600 last:border-0"
                >
                  {result.display_name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick Start - Contoh Rute */}
        <div className="pt-2">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">🏁 Contoh rute populer:</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => {
                setStartQuery('Manado');
                setEndQuery('Gorontalo');
                onStartChange({ lat: 1.4748, lng: 124.8421, name: 'Manado, Sulawesi Utara' });
                onEndChange({ lat: 0.5435, lng: 123.0568, name: 'Gorontalo' });
              }}
              className="text-xs px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            >
              Manado → Gorontalo
            </button>
            <button
              onClick={() => {
                setStartQuery('Jakarta');
                setEndQuery('Bandung');
                onStartChange({ lat: -6.2088, lng: 106.8456, name: 'Jakarta' });
                onEndChange({ lat: -6.9175, lng: 107.6191, name: 'Bandung' });
              }}
              className="text-xs px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            >
              Jakarta → Bandung
            </button>
            <button
              onClick={() => {
                setStartQuery('Medan');
                setEndQuery('Berastagi');
                onStartChange({ lat: 3.5952, lng: 98.6722, name: 'Medan, Sumatera Utara' });
                onEndChange({ lat: 3.2167, lng: 98.5167, name: 'Berastagi, Karo' });
              }}
              className="text-xs px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            >
              Medan → Berastagi
            </button>
            <button
              onClick={() => {
                setStartQuery('Surabaya');
                setEndQuery('Malang');
                onStartChange({ lat: -7.2575, lng: 112.7521, name: 'Surabaya, Jawa Timur' });
                onEndChange({ lat: -7.9786, lng: 112.6317, name: 'Malang, Jawa Timur' });
              }}
              className="text-xs px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            >
              Surabaya → Malang
            </button>
          </div>
        </div>

        {/* Tombol Submit */}
        <button
          onClick={onSubmit}
          disabled={isLoading}
          className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-lg shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
      </div>
    </div>
  );
}
