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
  const coordinatesRef = useRef({ lat, lon });
  const onChangeRef = useRef(onChange);
  coordinatesRef.current = { lat, lon };
  onChangeRef.current = onChange;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let map: import('leaflet').Map | null = null;

    void import('leaflet').then((leaflet) => {
      if (cancelled || !container.isConnected) return;

      const L = leaflet.default;
      const coordinates = coordinatesRef.current;
      const initialLat = coordinates.lat;
      const initialLon = coordinates.lon;
      const hasCoordinates = initialLat !== null && initialLon !== null;
      const center: [number, number] = hasCoordinates ? [initialLat, initialLon] : DEFAULT_CENTER;

      const leafletMap = L.map(container, {
        center,
        zoom: hasCoordinates ? 11 : DEFAULT_ZOOM,
        zoomControl: false,
      });
      map = leafletMap;

      mapRef.current = leafletMap;

      L.control.zoom({ position: 'bottomright' }).addTo(leafletMap);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(leafletMap);

      // If coords already set, place marker
      if (hasCoordinates) {
        markerRef.current = L.marker([initialLat, initialLon], { draggable: true })
          .addTo(leafletMap)
          .on('dragend', (e) => {
            const pos = (e.target as import('leaflet').Marker).getLatLng();
            onChangeRef.current(+pos.lat.toFixed(6), +pos.lng.toFixed(6));
          });
      }

      // Click to set/move marker
      leafletMap.on('click', (e) => {
        const { lat: clickLat, lng: clickLon } = e.latlng;
        const rounded = { lat: +clickLat.toFixed(6), lon: +clickLon.toFixed(6) };

        if (markerRef.current) {
          markerRef.current.setLatLng([rounded.lat, rounded.lon]);
        } else {
          markerRef.current = L.marker([rounded.lat, rounded.lon], { draggable: true })
            .addTo(leafletMap)
            .on('dragend', (ev) => {
              const pos = (ev.target as import('leaflet').Marker).getLatLng();
              onChangeRef.current(+pos.lat.toFixed(6), +pos.lng.toFixed(6));
            });
        }

        onChangeRef.current(rounded.lat, rounded.lon);
      });

      requestAnimationFrame(() => {
        if (!cancelled) leafletMap.invalidateSize();
      });
    }).catch((error: unknown) => {
      console.error('Could not initialize the location picker.', error);
    });

    return () => {
      cancelled = true;
      map?.remove();
      if (mapRef.current === map) mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Sync marker when lat/lon change externally (e.g. "use my location")
  useEffect(() => {
    const map = mapRef.current;
    if (!map || lat === null || lon === null) return;

    let cancelled = false;
    void import('leaflet').then((leaflet) => {
      if (cancelled || mapRef.current !== map) return;

      const L = leaflet.default;
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lon]);
      } else {
        markerRef.current = L.marker([lat, lon], { draggable: true })
          .addTo(map)
          .on('dragend', (e) => {
            const pos = (e.target as import('leaflet').Marker).getLatLng();
            onChangeRef.current(+pos.lat.toFixed(6), +pos.lng.toFixed(6));
          });
      }
      map.flyTo([lat, lon], 12, { duration: 1 });
    });

    return () => {
      cancelled = true;
    };
  }, [lat, lon]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-body font-medium text-slate-300">
          📍 Locație pe hartă
        </span>
        {lat !== null && lon !== null && (
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
        {(lat === null || lon === null) && (
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
