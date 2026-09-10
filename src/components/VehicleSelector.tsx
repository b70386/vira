import { useState, useMemo } from 'react';
import { vehicles, Vehicle } from '../data/vehicles';

interface VehicleSelectorProps {
  selectedVehicle: Vehicle | null;
  onSelect: (vehicle: Vehicle) => void;
  specialConditions: string;
  onSpecialConditionsChange: (value: string) => void;
}

export default function VehicleSelector({ selectedVehicle, onSelect, specialConditions, onSpecialConditionsChange }: VehicleSelectorProps) {
  const [filterMerk, setFilterMerk] = useState<string>('all');
  const [filterBBM, setFilterBBM] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showDetails, setShowDetails] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const merks = ['all', ...Array.from(new Set(vehicles.map(v => v.merk)))];
  const bbms = ['all', ...Array.from(new Set(vehicles.map(v => v.bbm)))];
  const categories = ['all', ...Array.from(new Set(vehicles.map(v => v.category)))];

  const filteredVehicles = useMemo(() => {
    return vehicles
      .filter(v => {
        if (filterMerk !== 'all' && v.merk !== filterMerk) return false;
        if (filterBBM !== 'all' && v.bbm !== filterBBM) return false;
        if (filterCategory !== 'all' && v.category !== filterCategory) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          return v.merk.toLowerCase().includes(q) ||
                 v.jenis.toLowerCase().includes(q) ||
                 v.name.toLowerCase().includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        // Sort by merk, then by year descending
        if (a.merk !== b.merk) return a.merk.localeCompare(b.merk);
        return b.tahun - a.tahun;
      });
  }, [filterMerk, filterBBM, filterCategory, searchQuery]);

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Low': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'High': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'Very High': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getBBMIcon = (bbm: string) => {
    switch (bbm) {
      case 'Solar': return '⛽';
      case 'Bensin': return '🔥';
      case 'Listrik': return '⚡';
      case 'Hybrid': return '🔋';
      default: return '⛽';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 border border-gray-200 dark:border-gray-700">
      <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
        <span className="text-2xl">🚗</span> Pilih Kendaraan
        <span className="text-xs font-normal text-gray-400 dark:text-gray-500 ml-auto">
          {filteredVehicles.length} kendaraan
        </span>
      </h2>

      {/* Search */}
      <div className="mb-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 Cari merk atau model..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Filter */}
      <div className="space-y-2 mb-4">
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Merk</label>
          <div className="flex flex-wrap gap-1.5">
            {merks.map(merk => (
              <button
                key={merk}
                onClick={() => setFilterMerk(merk)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
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
          <div className="flex flex-wrap gap-1.5">
            {bbms.map(bbm => (
              <button
                key={bbm}
                onClick={() => setFilterBBM(bbm)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  filterBBM === bbm 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {bbm === 'all' ? 'Semua' : `${getBBMIcon(bbm)} ${bbm}`}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Kategori</label>
          <div className="flex flex-wrap gap-1.5">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  filterCategory === cat 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {cat === 'all' ? 'Semua' : cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabel Kendaraan */}
      <div className="max-h-[400px] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
            <tr>
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Merk</th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">BBM</th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Jenis</th>
              <th className="px-2 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300">Thn</th>
              <th className="px-2 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300">Risiko</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
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
                <td className="px-2 py-1.5 text-gray-800 dark:text-gray-200 font-medium text-xs">{vehicle.merk}</td>
                <td className="px-2 py-1.5 text-gray-600 dark:text-gray-400 text-xs">
                  <span className="mr-0.5">{getBBMIcon(vehicle.bbm)}</span>
                  {vehicle.bbm}
                </td>
                <td className="px-2 py-1.5 text-gray-700 dark:text-gray-300 text-xs">{vehicle.jenis}</td>
                <td className="px-2 py-1.5 text-center text-gray-600 dark:text-gray-400 text-xs">{vehicle.tahun}</td>
                <td className="px-2 py-1.5 text-center">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${getRiskColor(vehicle.risk_level)}`}>
                    {vehicle.risk_level}
                  </span>
                </td>
              </tr>
            ))}
            {filteredVehicles.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400 text-sm">
                  Tidak ada kendaraan yang cocok dengan filter
                </td>
              </tr>
            )}
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
                {selectedVehicle.engine} • {selectedVehicle.drivetrain} • {selectedVehicle.category}
              </p>
            </div>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline shrink-0 ml-2"
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
              <div>📐 Departure: {selectedVehicle.departure_angle}°</div>
              <div>🔧 Breakover: {selectedVehicle.breakover_angle}°</div>
              <div className="col-span-2 mt-1 text-gray-500 dark:text-gray-400 italic">
                💡 {selectedVehicle.notes}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Kondisi Khusus Kendaraan */}
      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          🔧 Kondisi Khusus Kendaraan <span className="text-xs text-gray-500">(opsional)</span>
        </label>
        <textarea
          value={specialConditions}
          onChange={(e) => onSpecialConditionsChange(e.target.value)}
          placeholder="Contoh: kampas rem sudah tipis, stir agak oleng ke kanan, AC tidak dingin, ban sudah 3 tahun belum diganti, dll."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          rows={3}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          💡 Kondisi ini akan dianalisis dan mempengaruhi skor kelayakan
        </p>
      </div>
    </div>
  );
}
