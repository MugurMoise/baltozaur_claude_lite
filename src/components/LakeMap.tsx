import { useEffect, useRef } from 'react';
import type { LakeScore } from '../types/lake';
import { getScoreColor, getScoreLabel } from '../types/lake';

interface Props {
  lakes: LakeScore[];
}

export function LakeMap({ lakes }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import('leaflet').Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    let L: typeof import('leaflet');
    import('leaflet').then((leaflet) => {
      L = leaflet.default;

      const map = L.map(mapRef.current!, {
        center: [44.55, 26.1],
        zoom: 9,
        zoomControl: false,
      });

      mapInstanceRef.current = map;

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Dark tile layer
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
      }).addTo(map);

      lakes.forEach((lake) => {
        const color = getScoreColor(lake.score);
        const label = getScoreLabel(lake.score, 'ro');

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
              ${lake.county} · ${lake.distance_km} km
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

        L.marker([lake.lat, lake.lon], { icon }).bindPopup(popup).addTo(map);
      });
    });

    return () => {
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
    };
  }, []); // mount once

  // Update markers when lakes change (silent refresh)
  useEffect(() => {
    // markers update handled on mount; full re-render on key change via parent
  }, [lakes]);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-xl">
      <div ref={mapRef} className="h-[380px] sm:h-[440px] w-full" />
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
