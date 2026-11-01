import { useEffect, useRef, useState } from 'react';
import type { LakeScore } from '../types/lake';
import { getScoreColor, getScoreLabel } from '../types/lake';

interface Props {
  lakes: LakeScore[];
  variant?: 'mobile' | 'desktop';
}

function hasValidCoordinates(lake: LakeScore) {
  return Number.isFinite(lake.lat)
    && Number.isFinite(lake.lon)
    && Math.abs(lake.lat) <= 90
    && Math.abs(lake.lon) <= 180;
}

export function LakeMap({ lakes, variant = 'mobile' }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import('leaflet').Map | null>(null);
  const lakesRef = useRef(lakes);
  const [mapError, setMapError] = useState<string | null>(null);
  const lakeDataSignature = JSON.stringify(lakes);
  lakesRef.current = lakes;

  useEffect(() => {
    const container = mapRef.current;
    if (!container) return;

    let cancelled = false;
    let map: import('leaflet').Map | null = null;
    setMapError(null);

    void import('leaflet').then((leaflet) => {
      if (cancelled || !container.isConnected) return;

      const L = leaflet.default;
      const leafletMap = L.map(container, {
        center: [44.55, 26.1],
        zoom: 9,
        zoomControl: false,
      });
      map = leafletMap;

      mapInstanceRef.current = leafletMap;

      L.control.zoom({ position: 'bottomright' }).addTo(leafletMap);

      // OpenStreetMap's standard tiles are public and do not need a browser API key.
      const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      });
      tiles.on('tileerror', () => {
        if (!cancelled) setMapError('Fundalul hărții nu s-a putut încărca. Verifică conexiunea și reîncearcă.');
      });
      tiles.addTo(leafletMap);

      const validLakes = lakesRef.current.filter(hasValidCoordinates);
      const bounds = L.latLngBounds([]);

      validLakes.forEach((lake) => {
        const color = getScoreColor(lake.score);
        const label = getScoreLabel(lake.score, 'ro');
        const locationLabel = lake.county;

        const icon = L.divIcon({
          className: '',
          html: `
            <div style="
              width: 36px; height: 36px;
              background: ${color}22;
              border: 2px solid ${color};
              border-radius: 50%;
              display: flex; align-items: center; justify-content: center;
              box-shadow: 0 0 12px ${color}66;
              position: relative;
            ">
              <span style="color: ${color}; font-size: 11px; font-weight: 700; font-family: 'JetBrains Mono', monospace;">
                ${Math.round(lake.score)}
              </span>
              <div style="
                position: absolute; inset: -4px; border-radius: 50%;
                border: 1px solid ${color}33;
              "></div>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        const popup = L.popup({
          className: 'baltozaur-popup',
          maxWidth: 240,
        }).setContent(`
          <div style="
            background: #0f1419; border: 1px solid #ffffff15;
            border-radius: 12px; padding: 12px; font-family: 'DM Sans', sans-serif;
            color: white; min-width: 200px;
          ">
            <div style="font-family: 'Bebas Neue', cursive; font-size: 18px; letter-spacing: 1px; margin-bottom: 4px;">
              ${lake.name}
            </div>
            <div style="font-size: 11px; color: #64748b; margin-bottom: 10px;">
              ${locationLabel}
            </div>
            <div style="
              display: inline-flex; align-items: center; gap: 6px;
              background: ${color}20; border: 1px solid ${color}40;
              border-radius: 20px; padding: 2px 10px; margin-bottom: 10px;
            ">
              <span style="color: ${color}; font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 700;">${Math.round(lake.score)}</span>
              <span style="color: ${color}; font-size: 11px;">${label}</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 10px;">
              <div>
                <div style="font-size: 9px; color: #475569; text-transform: uppercase; letter-spacing: 1px;">Temp</div>
                <div style="font-size: 12px; font-family: 'JetBrains Mono', monospace;">${lake.temperature}°C</div>
              </div>
              <div>
                <div style="font-size: 9px; color: #475569; text-transform: uppercase; letter-spacing: 1px;">Press</div>
                <div style="font-size: 12px; font-family: 'JetBrains Mono', monospace;">${lake.pressure}</div>
              </div>
              <div>
                <div style="font-size: 9px; color: #475569; text-transform: uppercase; letter-spacing: 1px;">Wind</div>
                <div style="font-size: 12px; font-family: 'JetBrains Mono', monospace;">${lake.wind_speed}km/h</div>
              </div>
            </div>
            ${lake.feeding_windows && lake.feeding_windows.length > 0 ? `
              <div style="font-size: 9px; color: #475569; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Feeding Windows</div>
              <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 10px;">
                ${lake.feeding_windows.map(w => `<span style="background: #0891b215; border: 1px solid #0891b230; color: #67e8f9; border-radius: 4px; padding: 1px 6px; font-size: 10px; font-family: 'JetBrains Mono', monospace;">🕐 ${w}</span>`).join('')}
              </div>
            ` : ''}
            <a href="https://www.google.com/maps/dir/?api=1&destination=${lake.lat},${lake.lon}"
               target="_blank"
               style="
                display: block; text-align: center;
                background: #0ea5e915; border: 1px solid #0ea5e940;
                color: #38bdf8; border-radius: 8px;
                padding: 6px; font-size: 11px; text-decoration: none;
                font-family: 'DM Sans', sans-serif;
               "
            >📍 Navigate Here</a>
          </div>
        `);

        L.marker([lake.lat, lake.lon], { icon }).bindPopup(popup).addTo(leafletMap);
        bounds.extend([lake.lat, lake.lon]);
      });

      if (validLakes.length === 1) {
        leafletMap.setView(bounds.getCenter(), 12);
      } else if (validLakes.length > 1) {
        leafletMap.fitBounds(bounds, { padding: [28, 28], maxZoom: 10 });
      }

      requestAnimationFrame(() => {
        if (!cancelled) leafletMap.invalidateSize();
      });
    }).catch((error: unknown) => {
      console.error('Could not initialize the map.', error);
      if (!cancelled) setMapError('Harta nu a putut fi inițializată. Reîncarcă pagina și încearcă din nou.');
    });

    return () => {
      cancelled = true;
      map?.remove();
      if (mapInstanceRef.current === map) mapInstanceRef.current = null;
    };
  }, [lakeDataSignature]);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-xl">
      <div ref={mapRef} className={variant === 'desktop' ? 'h-[calc(100vh-170px)] min-h-[560px] w-full' : 'h-[380px] sm:h-[440px] w-full'} />
      {mapError && (
        <div className="absolute inset-x-3 top-3 z-[400] rounded-xl border border-red-400/30 bg-mud-900/95 px-3 py-2 text-xs text-red-200 shadow-lg">
          {mapError}
        </div>
      )}
      <div className="absolute bottom-3 left-3 flex gap-1.5 z-[400]">
        {[
          { color: '#22c55e', label: '70–100' },
          { color: '#eab308', label: '40–70' },
          { color: '#ef4444', label: '0–40' },
        ].map(({ color, label }) => (
          <div
            key={label}
            className="flex items-center gap-1 bg-mud-900/90 backdrop-blur rounded-full px-2 py-1 border border-white/10"
          >
            <span className="w-2 h-2 rounded-full" style={{ background: color }} />
            <span className="text-[10px] text-slate-400 font-mono">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
