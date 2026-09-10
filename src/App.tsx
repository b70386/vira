import { useState, useCallback } from 'react';
import MapView from './components/MapView';
import RouteInput from './components/RouteInput';
import VehicleSelector from './components/VehicleSelector';
import AnalysisResult from './components/AnalysisResult';
import ElevationChart from './components/ElevationChart';
import { Vehicle } from './data/vehicles';
import { getRoute, getElevationData, analyzeRoute, queryPOIsAlongRoute } from './utils/routing';
import { analyzeFeasibility } from './utils/analysis';
import { RouteAnalysis, FeasibilityResult, ElevationData, Waypoint, POI } from './types';

function App() {
  // State untuk 4 waypoints (asal + 3 tujuan perantara)
  const [waypoints, setWaypoints] = useState<(Waypoint | null)[]>([null, null, null, null]);
  
  // State untuk kendaraan
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  
  // State untuk data rute
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [elevationData, setElevationData] = useState<ElevationData[]>([]);
  const [routeAnalysis, setRouteAnalysis] = useState<RouteAnalysis | null>(null);
  const [feasibilityResult, setFeasibilityResult] = useState<FeasibilityResult | null>(null);
  const [distanceKm, setDistanceKm] = useState(0);
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [pois, setPois] = useState<POI[]>([]);
  
  // State untuk loading dan error
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Handler untuk update waypoint
  const handleWaypointChange = useCallback((index: number, location: Waypoint | null) => {
    setWaypoints(prev => {
      const updated = [...prev];
      updated[index] = location;
      return updated;
    });
  }, []);

  // Handler untuk analisis rute
  const handleAnalyze = useCallback(async () => {
    // Filter waypoints yang tidak null (minimal 2 titik)
    const validWaypoints = waypoints.filter((w): w is Waypoint => w !== null);
    
    if (validWaypoints.length < 2) {
      setError('Silakan isi minimal 2 lokasi (asal dan 1 tujuan).');
      return;
    }
    if (!selectedVehicle) {
      setError('Silakan pilih kendaraan terlebih dahulu.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setFeasibilityResult(null);
    setRouteAnalysis(null);
    setElevationData([]);
    setRouteCoordinates([]);
    setPois([]);

    try {
      // Step 1: Dapatkan rute multi-waypoint
      setLoadingStep('Mengambil data rute...');
      const route = await getRoute(validWaypoints);
      
      setDistanceKm(route.distance_km);
      setDurationMinutes(route.duration_minutes);
      
      // Konversi geometry ke [lat, lng] untuk peta
      const coords: [number, number][] = route.geometry.map(coord => [coord[1], coord[0]]);
      setRouteCoordinates(coords);

      // Step 2: Tambah jarak kumulatif ke sampled points
      const sampleRate = Math.max(1, Math.floor(route.points.length / 80));
      const sampledPoints = route.points
        .filter((_, i) => i % sampleRate === 0 || i === route.points.length - 1)
        .map(p => ({ lat: p.lat, lng: p.lng, distance: p.distance || 0 }));
      
      // Step 3: Dapatkan data elevasi
      setLoadingStep('Mengambil data elevasi...');
      const elevData = await getElevationData(sampledPoints);
      
      // Tambah jarak ke elevation data
      const elevWithDistance: ElevationData[] = elevData.map((e, i) => ({
        ...e,
        distance_km: sampledPoints[i]?.distance 
          ? sampledPoints[i].distance! / 1000 
          : e.distance_km
      }));
      
      setElevationData(elevWithDistance);

      // Step 4: Analisis rute
      setLoadingStep('Menganalisis kondisi rute...');
      const analysis = analyzeRoute(elevWithDistance);
      setRouteAnalysis(analysis);

      // Step 5: Query POI (SPBU, Indomaret, Alfamart) di sepanjang rute
      setLoadingStep('Mencari SPBU & minimarket di sekitar rute...');
      let scaledPois: POI[] = [];
      try {
        const poiResults = await queryPOIsAlongRoute(coords);
        // Scale distance_from_start_km dari rasio ke km actual
        scaledPois = poiResults.map(poi => ({
          ...poi,
          distance_from_start_km: poi.distance_from_start_km * route.distance_km
        }));
        setPois(scaledPois);
      } catch (err) {
        console.warn('Gagal query POI:', err);
        // Tidak block analisis jika POI gagal
      }

      // Step 6: Analisis kelayakan (dengan data POI)
      setLoadingStep('Mengevaluasi kelayakan kendaraan...');
      const feasibility = analyzeFeasibility(selectedVehicle, analysis, scaledPois);
      setFeasibilityResult(feasibility);

      setLoadingStep('Selesai!');
    } catch (err) {
      console.error('Error analyzing route:', err);
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat menganalisis rute. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  }, [waypoints, selectedVehicle]);

  // Validasi: minimal 2 waypoint terisi
  const validWaypoints = waypoints.filter(w => w !== null);
  const canAnalyze = validWaypoints.length >= 2 && selectedVehicle !== null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 sticky top-0 z-[1001]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white text-xl">🗻</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800 dark:text-white">Rute Realistis</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Vehicle Route Feasibility Simulator</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
              🟢 OSRM Routing
            </span>
            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">
              📍 OpenStreetMap
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Loading State */}
        {isLoading && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[2000] flex items-center justify-center">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-2xl max-w-sm w-full mx-4 text-center">
              <div className="w-16 h-16 mx-auto mb-4 relative">
                <div className="absolute inset-0 border-4 border-blue-200 dark:border-blue-800 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">Menganalisis Rute</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{loadingStep}</p>
              <div className="mt-4 flex justify-center gap-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
            <span className="text-red-500 text-xl">⚠️</span>
            <div>
              <p className="font-medium text-red-800 dark:text-red-200">Error</p>
              <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Kolom Kiri - Input */}
          <div className="lg:col-span-1 space-y-6">
            <RouteInput
              waypoints={waypoints}
              onWaypointChange={handleWaypointChange}
              onSubmit={handleAnalyze}
              isLoading={isLoading}
              canAnalyze={canAnalyze}
            />
            <VehicleSelector
              selectedVehicle={selectedVehicle}
              onSelect={setSelectedVehicle}
            />
          </div>

          {/* Kolom Kanan - Peta dan Hasil */}
          <div className="lg:col-span-2 space-y-6">
            {/* Peta */}
            <div className="h-[400px] lg:h-[450px]">
              <MapView
                routeCoordinates={routeCoordinates}
                waypoints={waypoints.filter((w): w is Waypoint => w !== null)}
                elevationData={elevationData}
                pois={pois}
              />
            </div>

            {/* Profil Elevasi */}
            {elevationData.length > 0 && (
              <ElevationChart data={elevationData} />
            )}

            {/* Hasil Analisis */}
            {feasibilityResult && routeAnalysis && selectedVehicle && (
              <AnalysisResult
                result={feasibilityResult}
                routeAnalysis={routeAnalysis}
                vehicle={selectedVehicle}
                distanceKm={distanceKm}
                durationMinutes={durationMinutes}
                waypoints={waypoints.filter((w): w is Waypoint => w !== null)}
                pois={pois}
              />
            )}

            {/* Placeholder jika belum ada hasil */}
            {!feasibilityResult && !isLoading && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-200 dark:border-gray-700 text-center">
                <div className="text-6xl mb-4">🚗💨</div>
                <h3 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-2">
                  Siap Menganalisis Rute
                </h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                  Masukkan hingga 4 titik lokasi (asal + 3 tujuan perantara), pilih kendaraan, 
                  lalu klik "Analisis Rute" untuk melihat kelayakan kendaraan Anda.
                </p>
                <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-3 text-left max-w-2xl mx-auto">
                  <div className="flex items-start gap-2 bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                    <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">A</span>
                    <span className="text-sm text-gray-600 dark:text-gray-300">Lokasi Asal</span>
                  </div>
                  <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                    <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">B</span>
                    <span className="text-sm text-gray-600 dark:text-gray-300">Tujuan 1</span>
                  </div>
                  <div className="flex items-start gap-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
                    <span className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">C</span>
                    <span className="text-sm text-gray-600 dark:text-gray-300">Tujuan 2</span>
                  </div>
                  <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                    <span className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">D</span>
                    <span className="text-sm text-gray-600 dark:text-gray-300">Tujuan Akhir</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center text-xs text-gray-400 dark:text-gray-500 pb-6">
          <p>Data rute dari <a href="http://project-osrm.org" className="underline hover:text-blue-500" target="_blank" rel="noopener noreferrer">OSRM</a> • 
          Peta dari <a href="https://www.openstreetmap.org" className="underline hover:text-blue-500" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> • 
          Elevasi dari <a href="https://open-elevation.com" className="underline hover:text-blue-500" target="_blank" rel="noopener noreferrer">Open-Elevation</a></p>
          <p className="mt-1">⚠️ Hasil analisis bersifat estimasi. Selalu persiapkan diri dengan baik sebelum perjalanan.</p>
        </div>
      </main>
    </div>
  );
}

export default App;
