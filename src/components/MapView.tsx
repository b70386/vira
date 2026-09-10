import { useEffect, useRef } from 'react';
import L from 'leaflet';

interface MapViewProps {
  routeCoordinates: [number, number][]; // [lat, lng]
  startLocation: { lat: number; lng: number; name: string } | null;
  endLocation: { lat: number; lng: number; name: string } | null;
  elevationData: { distance_km: number; elevation_m: number; gradient: number }[];
}

export default function MapView({ routeCoordinates, startLocation, endLocation, elevationData }: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // Inisialisasi peta
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current).setView([-2.5, 118], 5);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);

    routeLayerRef.current = L.layerGroup().addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update rute dan marker
  useEffect(() => {
    const map = mapRef.current;
    const routeLayer = routeLayerRef.current;
    const markersLayer = markersLayerRef.current;
    
    if (!map || !routeLayer || !markersLayer) return;

    // Bersihkan layer sebelumnya
    routeLayer.clearLayers();
    markersLayer.clearLayers();

    // Gambar rute dengan warna berdasarkan gradient
    if (routeCoordinates.length > 1) {
      if (elevationData.length > 1) {
        // Warna berdasarkan gradient per segmen
        for (let i = 0; i < elevationData.length - 1; i++) {
          const startIdx = Math.min(Math.floor(i * routeCoordinates.length / elevationData.length), routeCoordinates.length - 1);
          const endIdx = Math.min(Math.floor((i + 1) * routeCoordinates.length / elevationData.length), routeCoordinates.length - 1);
          
          if (startIdx >= endIdx) continue;
          
          const gradient = Math.abs(elevationData[i].gradient);
          let color = '#22c55e'; // hijau
          if (gradient > 15) color = '#ef4444'; // merah
          else if (gradient > 10) color = '#eab308'; // kuning
          
          const segmentCoords: L.LatLngExpression[] = routeCoordinates.slice(startIdx, endIdx + 1);
          
          if (segmentCoords.length >= 2) {
            L.polyline(segmentCoords, {
              color,
              weight: 4,
              opacity: 0.8,
            }).addTo(routeLayer);
          }
        }
      } else {
        // Default hijau jika tidak ada data elevasi
        L.polyline(routeCoordinates, {
          color: '#22c55e',
          weight: 4,
          opacity: 0.8,
        }).addTo(routeLayer);
      }

      // Fit bounds ke rute
      const bounds = L.latLngBounds(routeCoordinates);
      map.fitBounds(bounds, { padding: [30, 30] });
    }

    // Tambah marker awal
    if (startLocation) {
      const startIcon = L.divIcon({
        className: 'custom-marker',
        html: '<div style="width:32px;height:32px;background:#22c55e;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:14px;">A</div>',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      L.marker([startLocation.lat, startLocation.lng], { icon: startIcon })
        .bindPopup(`<b>🟢 Asal:</b><br>${startLocation.name}`)
        .addTo(markersLayer);
    }

    // Tambah marker tujuan
    if (endLocation) {
      const endIcon = L.divIcon({
        className: 'custom-marker',
        html: '<div style="width:32px;height:32px;background:#ef4444;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:14px;">B</div>',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      L.marker([endLocation.lat, endLocation.lng], { icon: endIcon })
        .bindPopup(`<b>🔴 Tujuan:</b><br>${endLocation.name}`)
        .addTo(markersLayer);
    }

    // Tambah marker untuk segmen curam
    if (elevationData.length > 0 && routeCoordinates.length > 0) {
      const steepSegments = elevationData.filter(e => Math.abs(e.gradient) > 15);
      const maxDist = elevationData[elevationData.length - 1]?.distance_km || 1;
      
      steepSegments.forEach((segment) => {
        const ratio = segment.distance_km / maxDist;
        const coordIdx = Math.min(Math.floor(ratio * routeCoordinates.length), routeCoordinates.length - 1);
        
        if (coordIdx >= 0 && coordIdx < routeCoordinates.length) {
          const warningIcon = L.divIcon({
            className: 'custom-marker',
            html: '<div style="width:24px;height:24px;background:#eab308;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:12px;">⚠️</div>',
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          });
          L.marker([routeCoordinates[coordIdx][0], routeCoordinates[coordIdx][1]], { icon: warningIcon })
            .bindPopup(`<b>⚠️ Tanjakan Curam</b><br>Gradient: ${segment.gradient.toFixed(1)}%<br>KM: ${segment.distance_km.toFixed(1)}`)
            .addTo(markersLayer);
        }
      });
    }
  }, [routeCoordinates, startLocation, endLocation, elevationData]);

  return (
    <div className="relative w-full h-full min-h-[400px] rounded-xl overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700">
      <div ref={mapContainerRef} className="w-full h-full" style={{ minHeight: '400px' }} />
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg p-3 shadow-md text-xs z-[1000]">
        <p className="font-semibold mb-1 text-gray-700 dark:text-gray-200">Legenda:</p>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-4 h-1 bg-green-500 rounded"></div>
          <span className="text-gray-600 dark:text-gray-300">Aman (&lt;10%)</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-4 h-1 bg-yellow-500 rounded"></div>
          <span className="text-gray-600 dark:text-gray-300">Perhatian (10-15%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-1 bg-red-500 rounded"></div>
          <span className="text-gray-600 dark:text-gray-300">Risiko (&gt;15%)</span>
        </div>
      </div>
    </div>
  );
}
