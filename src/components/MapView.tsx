import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Waypoint, POI } from '../types';

interface MapViewProps {
  routeCoordinates: [number, number][]; // [lat, lng]
  waypoints: Waypoint[];
  elevationData: { distance_km: number; elevation_m: number; gradient: number }[];
  pois: POI[];
}

// Warna marker untuk setiap waypoint
const MARKER_COLORS: Record<string, string> = {
  A: '#22c55e', // green
  B: '#3b82f6', // blue
  C: '#a855f7', // purple
  D: '#ef4444', // red
};

export default function MapView({ routeCoordinates, waypoints, elevationData, pois }: MapViewProps) {
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

    // Tambah marker untuk setiap waypoint
    waypoints.forEach((wp) => {
      const color = MARKER_COLORS[wp.label] || '#6b7280';
      const isFirst = wp.label === 'A';
      const isLast = wp.label === waypoints[waypoints.length - 1]?.label;
      
      let iconLabel = wp.label;
      let iconEmoji = '';
      if (isFirst) iconEmoji = '📍';
      else if (isLast) iconEmoji = '🏁';
      
      const markerIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="
          width:36px;
          height:36px;
          background:${color};
          border-radius:50%;
          border:3px solid white;
          box-shadow:0 2px 8px rgba(0,0,0,0.3);
          display:flex;
          align-items:center;
          justify-content:center;
          color:white;
          font-weight:bold;
          font-size:${isFirst || isLast ? '16px' : '14px'};
        ">${iconEmoji || iconLabel}</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const title = isFirst ? '🟢 Asal' : isLast ? '🔴 Tujuan Akhir' : `📌 ${wp.label}`;
      const shortName = wp.name.split(',').slice(0, 3).join(',');
      
      L.marker([wp.lat, wp.lng], { icon: markerIcon })
        .bindPopup(`<b>${title}:</b><br>${shortName}`)
        .addTo(markersLayer);
    });

    // Tambah marker untuk segmen curam
    if (elevationData.length > 0 && routeCoordinates.length > 0) {
      const steepSegments = elevationData.filter(e => Math.abs(e.gradient) > 15);
      const maxDist = elevationData[elevationData.length - 1]?.distance_km || 1;
      
      // Batasi jumlah marker warning agar tidak terlalu penuh
      const maxWarnings = 10;
      const step = Math.max(1, Math.floor(steepSegments.length / maxWarnings));
      
      steepSegments.filter((_, i) => i % step === 0).forEach((segment) => {
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

    // Tambah marker untuk POI (SPBU, Indomaret, Alfamart)
    if (pois.length > 0) {
      pois.forEach((poi) => {
        let iconHtml = '';
        let popupContent = '';
        
        switch (poi.type) {
          case 'spbu':
            iconHtml = '<div style="width:28px;height:28px;background:#f59e0b;border-radius:6px;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:14px;">⛽</div>';
            popupContent = `<b>⛽ SPBU</b><br>${poi.name}<br>KM: ${poi.distance_from_start_km.toFixed(1)}`;
            break;
          case 'indomaret':
            iconHtml = '<div style="width:26px;height:26px;background:#ef4444;border-radius:6px;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:12px;color:white;font-weight:bold;">I</div>';
            popupContent = `<b>🏪 Indomaret</b><br>${poi.name}<br>KM: ${poi.distance_from_start_km.toFixed(1)}`;
            break;
          case 'alfamart':
            iconHtml = '<div style="width:26px;height:26px;background:#3b82f6;border-radius:6px;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:12px;color:white;font-weight:bold;">A</div>';
            popupContent = `<b>🏪 Alfamart</b><br>${poi.name}<br>KM: ${poi.distance_from_start_km.toFixed(1)}`;
            break;
          default:
            iconHtml = '<div style="width:24px;height:24px;background:#8b5cf6;border-radius:6px;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:11px;color:white;">M</div>';
            popupContent = `<b>🏪 Minimarket</b><br>${poi.name}<br>KM: ${poi.distance_from_start_km.toFixed(1)}`;
        }
        
        const poiIcon = L.divIcon({
          className: 'custom-marker',
          html: iconHtml,
          iconSize: poi.type === 'spbu' ? [28, 28] : [26, 26],
          iconAnchor: poi.type === 'spbu' ? [14, 14] : [13, 13],
        });
        
        L.marker([poi.lat, poi.lng], { icon: poiIcon })
          .bindPopup(popupContent)
          .addTo(markersLayer);
      });
    }
  }, [routeCoordinates, waypoints, elevationData, pois]);

  return (
    <div className="relative w-full h-full min-h-[400px] rounded-xl overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700">
      <div ref={mapContainerRef} className="w-full h-full" style={{ minHeight: '400px' }} />
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg p-3 shadow-md text-xs z-[1000]">
        <p className="font-semibold mb-1.5 text-gray-700 dark:text-gray-200">Legenda Rute:</p>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-4 h-1 bg-green-500 rounded"></div>
          <span className="text-gray-600 dark:text-gray-300">Aman (&lt;10%)</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-4 h-1 bg-yellow-500 rounded"></div>
          <span className="text-gray-600 dark:text-gray-300">Perhatian (10-15%)</span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-4 h-1 bg-red-500 rounded"></div>
          <span className="text-gray-600 dark:text-gray-300">Risiko (&gt;15%)</span>
        </div>
        {waypoints.length > 0 && (
          <>
            <p className="font-semibold mb-1 text-gray-700 dark:text-gray-200 border-t border-gray-200 dark:border-gray-600 pt-1.5">Waypoints:</p>
            {waypoints.map(wp => (
              <div key={wp.label} className="flex items-center gap-2 mb-0.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: MARKER_COLORS[wp.label] }}></div>
                <span className="text-gray-600 dark:text-gray-300">
                  {wp.label}: {wp.name.split(',')[0]}
                </span>
              </div>
            ))}
          </>
        )}
        {pois.length > 0 && (
          <>
            <p className="font-semibold mb-1 text-gray-700 dark:text-gray-200 border-t border-gray-200 dark:border-gray-600 pt-1.5">Fasilitas:</p>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs">⛽</span>
              <span className="text-gray-600 dark:text-gray-300">SPBU ({pois.filter(p => p.type === 'spbu').length})</span>
            </div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs text-red-500 font-bold">I</span>
              <span className="text-gray-600 dark:text-gray-300">Indomaret ({pois.filter(p => p.type === 'indomaret').length})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-blue-500 font-bold">A</span>
              <span className="text-gray-600 dark:text-gray-300">Alfamart ({pois.filter(p => p.type === 'alfamart').length})</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
