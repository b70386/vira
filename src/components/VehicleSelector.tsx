import { useState } from 'react';
import { vehicles, Vehicle } from '../data/vehicles';

interface VehicleSelectorProps {
  selectedVehicle: Vehicle | null;
  onSelect: (vehicle: Vehicle) => void;
}

export default function VehicleSelector({ selectedVehicle, onSelect }: VehicleSelectorProps) {
  const [filterMerk, setFilterMerk] = useState<string>('all');
  const [filterBBM, setFilterBBM] = useState<string>('all');
  const [showDetails, setShowDetails] = useState(false);

  const merks = ['all', ...Array.from(new Set(vehicles.map(v => v.merk)))];
  const bbms = ['all', ...Array.from(new Set(vehicles.map(v => v.bbm)))];
  
  const filteredVehicles = vehicles.filter(v => {
    if (filterMerk !== 'all' && v.merk !== filterMerk) return false;
    if (filterBBM !== 'all' && v.bbm !== filterBBM) return false;
    return true;
  });

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Low': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'High': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'Very High': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 border border-gray-200 dark:border-gray-700">
      <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
        <span className="text-2xl">🚗</span> Pilih Kendaraan
      </h2>

      {/* Filter */}
      <div className="space-y-3 mb-4">
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Merk</label>
          <div className="flex flex-wrap gap-2">
            {merks.map(merk => (
              <button
                key={merk}
                onClick={() => setFilterMerk(merk)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  filterMerk === merk 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {merk === 'all' ? 'Semua' : merk}
              </button>
            ))}
          </div>
        </div>
        
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">BBM</label>
          <div className="flex flex-wrap gap-2">
            {bbms.map(bbm => (
              <button
                key={bbm}
                onClick={() => setFilterBBM(bbm)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  filterBBM === bbm 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {bbm === 'all' ? 'Semua' : bbm}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabel Kendaraan */}
      <div className="max-h-[400px] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Merk</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">BBM</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Jenis</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300">Tahun</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300">Risiko</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredVehicles.map(vehicle => (
              <tr
                key={vehicle.id}
                onClick={() => { onSelect(vehicle); setShowDetails(false); }}
                className={`cursor-pointer transition-colors ${
                  selectedVehicle?.id === vehicle.id
                    ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-l-blue-500'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <td className="px-3 py-2 text-gray-800 dark:text-gray-200 font-medium">{vehicle.merk}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{vehicle.bbm}</td>
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{vehicle.jenis}</td>
                <td className="px-3 py-2 text-center text-gray-600 dark:text-gray-400">{vehicle.tahun}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${getRiskColor(vehicle.risk_level)}`}>
                    {vehicle.risk_level}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail Kendaraan Terpilih */}
      {selectedVehicle && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="font-semibold text-sm text-gray-800 dark:text-white">
                {selectedVehicle.merk} {selectedVehicle.jenis} ({selectedVehicle.tahun})
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                {selectedVehicle.engine} • {selectedVehicle.drivetrain}
              </p>
            </div>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              {showDetails ? 'Sembunyikan' : 'Detail'}
            </button>
          </div>
          
          {showDetails && (
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-300 pt-2 border-t border-blue-200 dark:border-blue-800">
              <div>⬆️ Ground: {selectedVehicle.ground_clearance_mm}mm</div>
              <div>💪 Torsi: {selectedVehicle.torque_nm}Nm</div>
              <div>⛽ Range: {selectedVehicle.range_km}km</div>
              <div>🏋️ Berat: {selectedVehicle.weight_kg}kg</div>
              <div>🌊 Wading: {selectedVehicle.wading_depth_mm}mm</div>
              <div>📐 Approach: {selectedVehicle.approach_angle}°</div>
              <div className="col-span-2 mt-1 text-gray-500 dark:text-gray-400 italic">
                💡 {selectedVehicle.notes}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
