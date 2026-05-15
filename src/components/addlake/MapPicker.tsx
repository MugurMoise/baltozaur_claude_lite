import { useEffect, useRef } from 'react';

interface Props {
  lat: number | null;
  lon: number | null;
  onChange: (lat: number, lon: number) => void;
}

// Default center: Bucharest area
const DEFAULT_CENTER: [number, number] = [44.55, 26.1];
const DEFAULT_ZOOM = 8;

export function MapPicker({ lat, lon, onChange }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<import('leaflet').Map | null>(null);
  const markerRef     = useRef<import('leaflet').Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    import('leaflet').then((leaflet) => {
      const L = leaflet.default;

      const map = L.map(containerRef.current!, {
        center: lat && lon ? [lat, lon] : DEFAULT_CENTER,
        zoom: lat && lon ? 11 : DEFAULT_ZOOM,
        zoomControl: false,
      });

      mapRef.current = map;

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OSM © CARTO',
        maxZoom: 19,
      }).addTo(map);

      // If coords already set, place marker
      if (lat && lon) {
        markerRef.current = L.marker([lat, lon], { draggable: true })
          .addTo(map)
          .on('dragend', (e) => {
            const pos = (e.target as import('leaflet').Marker).getLatLng();
            onChange(+pos.lat.toFixed(6), +pos.lng.toFixed(6));
          });
      }

      // Click to set/move marker
      map.on('click', (e) => {
        const { lat: clickLat, lng: clickLon } = e.latlng;
        const rounded = { lat: +clickLat.toFixed(6), lon: +clickLon.toFixed(6) };

        if (markerRef.current) {
          markerRef.current.setLatLng([rounded.lat, rounded.lon]);
        } else {
          markerRef.current = L.marker([rounded.lat, rounded.lon], { draggable: true })
            .addTo(map)
            .on('dragend', (ev) => {
              const pos = (ev.target as import('leaflet').Marker).getLatLng();
              onChange(+pos.lat.toFixed(6), +pos.lng.toFixed(6));
            });
        }

        onChange(rounded.lat, rounded.lon);
      });
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Sync marker when lat/lon change externally (e.g. "use my location")
  useEffect(() => {
    if (!mapRef.current || lat === null || lon === null) return;
    import('leaflet').then((leaflet) => {
      const L = leaflet.default;
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lon]);
      } else {
        markerRef.current = L.marker([lat, lon], { draggable: true })
          .addTo(mapRef.current!)
          .on('dragend', (e) => {
            const pos = (e.target as import('leaflet').Marker).getLatLng();
            onChange(+pos.lat.toFixed(6), +pos.lng.toFixed(6));
          });
      }
      mapRef.current!.flyTo([lat, lon], 12, { duration: 1 });
    });
  }, [lat, lon]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-body font-medium text-slate-300">
          📍 Locație pe hartă
        </span>
        {lat && lon && (
          <span className="text-xs font-mono text-slate-500">
            {lat.toFixed(4)}, {lon.toFixed(4)}
          </span>
        )}
      </div>

      <div
        className="relative rounded-2xl overflow-hidden border border-white/10"
        style={{ height: 260 }}
      >
        <div ref={containerRef} className="w-full h-full" />

        {/* Hint overlay */}
        {!lat && !lon && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-mud-900/80 backdrop-blur rounded-xl px-4 py-2 text-sm text-slate-400 font-body">
              Apasă pe hartă pentru a seta locația
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
