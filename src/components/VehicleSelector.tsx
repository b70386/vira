import { useState } from 'react';
import { vehicles, Vehicle } from '../data/vehicles';

interface VehicleSelectorProps {
  selectedVehicle: Vehicle | null;
  onSelect: (vehicle: Vehicle) => void;
}

export default function VehicleSelector({ selectedVehicle, onSelect }: VehicleSelectorProps) {
  const [filter, setFilter] = useState<string>('all');
  const [showDetails, setShowDetails] = useState(false);

  const categories = ['all', ...new Set(vehicles.map(v => v.category))];
  
  const filteredVehicles = filter === 'all' 
    ? vehicles 
    : vehicles.filter(v => v.category === filter);

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
      <div className="flex flex-wrap gap-2 mb-4">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === cat 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {cat === 'all' ? 'Semua' : cat}
          </button>
        ))}
      </div>

      {/* List Kendaraan */}
      <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
        {filteredVehicles.map(vehicle => (
          <div
            key={vehicle.id}
            onClick={() => { onSelect(vehicle); setShowDetails(false); }}
            className={`p-3 rounded-lg border cursor-pointer transition-all ${
              selectedVehicle?.id === vehicle.id
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-200 dark:ring-blue-700'
                : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="font-medium text-sm text-gray-800 dark:text-white">{vehicle.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{vehicle.drivetrain}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${getRiskColor(vehicle.risk_level)}`}>
                    {vehicle.risk_level}
                  </span>
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setShowDetails(!showDetails); }}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Detail
              </button>
            </div>
            
            {showDetails && selectedVehicle?.id === vehicle.id && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-300">
                <div>⬆️ Ground: {vehicle.ground_clearance_mm}mm</div>
                <div>🔧 Mesin: {vehicle.engine}</div>
                <div>💪 Torsi: {vehicle.torque_nm}Nm</div>
                <div>⛽ Range: {vehicle.range_km}km</div>
                <div>🏋️ Berat: {vehicle.weight_kg}kg</div>
                <div>🌊 Wading: {vehicle.wading_depth_mm}mm</div>
                <div>📐 Approach: {vehicle.approach_angle}°</div>
                <div>📐 Departure: {vehicle.departure_angle}°</div>
                <div className="col-span-2 mt-1 text-gray-500 dark:text-gray-400 italic">
                  💡 {vehicle.notes}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
