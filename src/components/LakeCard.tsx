import { useState } from 'react';
import type { LakeScore } from '../types/lake';
import { getScoreColor, getScoreGradient, getScoreLevel, getRecommendation, getConditionTags } from '../types/lake';
import type { Lang } from '../i18n';
import { t } from '../i18n';

interface Props {
  lake: LakeScore;
  rank?: number;
  lang: Lang;
  userLocation?: { lat: number; lon: number } | null;
}

function distanceBetweenKm(from: { lat: number; lon: number }, to: { lat: number; lon: number }) {
  const earthRadiusKm = 6371;
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLon = toRad(to.lon - from.lon);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function LakeCard({ lake, rank, lang, userLocation }: Props) {
  const [expanded, setExpanded] = useState(false);
  const tr = t[lang];
  const level = getScoreLevel(lake.score);
  const scoreColor = getScoreColor(lake.score);
  const gradient = getScoreGradient(lake.score);
  const recommendation = getRecommendation(lake.score, lang);
  const conditionTags = getConditionTags(lake, lang);
  const userDistance = userLocation
    ? Math.round(distanceBetweenKm(userLocation, { lat: lake.lat, lon: lake.lon }))
    : null;
  const locationLabel = userDistance == null
    ? lake.county
    : `${lake.county} · ${userDistance} ${tr.distanceFromYou}`;
  const websiteHref = lake.website_url ?? lake.facebook_url;
  const phoneNumbers = lake.phone?.split(/[,/]/).map((phone) => phone.trim()).filter(Boolean) ?? [];
  const hasRainWarning = (lake.precipitation ?? 0) > 0 || (lake.rain_hours ?? 0) > 0;

  const isGood = level === 'excellent' || level === 'veryGood' || level === 'good';

  return (
    <article
      className={`relative rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br ${gradient} backdrop-blur-sm shadow-xl transition-all duration-300 active:scale-[0.99]`}
    >
      {/* Score bar at top */}
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, transparent, ${scoreColor}, transparent)` }} />

      <div className="p-5">
        {/* Main row: rank + name + score circle */}
        <div className="flex items-center gap-4 mb-4">
          {/* Score circle — large and dominant */}
          <div
            className="shrink-0 w-16 h-16 rounded-2xl flex flex-col items-center justify-center border-2"
            style={{ borderColor: scoreColor, background: `${scoreColor}18` }}
          >
            <span className="font-mono font-bold text-xl leading-none" style={{ color: scoreColor }}>
              {Math.round(lake.score)}
            </span>
            <span className="text-[9px] uppercase tracking-widest mt-0.5" style={{ color: scoreColor }}>
              scor
            </span>
          </div>

          {/* Name + location */}
          <div className="flex-1 min-w-0">
            {rank !== undefined && (
              <span className="text-[10px] text-slate-500 font-body uppercase tracking-widest">#{rank}</span>
            )}
            <h2 className="font-display text-xl text-white leading-tight tracking-wide truncate">
              {lake.name}
            </h2>
            <p className="text-sm text-slate-400 font-body mt-0.5">
              {locationLabel}
            </p>
          </div>
        </div>

        {/* Recommendation — the most important thing */}
        <div
          className={`rounded-2xl px-4 py-3 mb-4 flex items-center gap-3 ${
            isGood
              ? 'bg-green-500/15 border border-green-500/30'
              : level === 'fair'
              ? 'bg-yellow-500/15 border border-yellow-500/30'
              : 'bg-red-500/15 border border-red-500/30'
          }`}
        >
          <span className="text-2xl">{recommendation.split(' ')[0]}</span>
          <span className={`font-body font-semibold text-base ${
            isGood ? 'text-green-300' : level === 'fair' ? 'text-yellow-300' : 'text-red-300'
          }`}>
            {recommendation.split(' ').slice(1).join(' ')}
          </span>
        </div>

        {/* Condition tags — plain language */}
        <div className="flex flex-wrap gap-2 mb-4">
          {conditionTags.map((tag, i) => (
            <span
              key={i}
              className="text-sm bg-white/5 border border-white/10 text-slate-300 rounded-xl px-3 py-1.5 font-body"
            >
              {tag}
            </span>
          ))}
        </div>

        {hasRainWarning && (
          <div className="bg-red-500/15 border border-red-500/30 rounded-2xl px-4 py-3 mb-4">
            <p className="text-xs text-red-300 uppercase tracking-wider font-body mb-1">
              {tr.rainWarning}
            </p>
            <p className="text-sm text-red-100 font-body">
              {tr.rainWarningText}
            </p>
          </div>
        )}

        {/* Feeding windows — prominent */}
        {lake.feeding_windows && lake.feeding_windows.length > 0 && (
          <div className="bg-cyan-500/10 border border-cyan-500/25 rounded-2xl px-4 py-3 mb-4">
            <p className="text-xs text-cyan-400 uppercase tracking-wider font-body mb-2">
              {tr.feedingWindows}
            </p>
            <div className="flex flex-wrap gap-2">
              {lake.feeding_windows.map((w, i) => (
                <span key={i} className="text-base font-mono text-cyan-200 font-semibold">
                  {w}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions row */}
        <div className="flex items-center gap-3">
          {/* Navigate — big button */}
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${lake.lat},${lake.lon}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 bg-lake-600/30 border border-lake-500/40 hover:bg-lake-600/50 text-white rounded-2xl py-3 font-body font-semibold text-sm transition-all active:scale-95"
          >
            {tr.navigate}
          </a>

          {/* Expand for tech details */}
          <button
            onClick={() => setExpanded((e) => !e)}
            className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all active:scale-95"
            title="Detalii tehnice"
          >
            <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Technical details — collapsed by default */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-white/10 animate-fade-in">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-body">{tr.temp}</span>
                <span className="text-white font-mono text-sm">{lake.temperature}°C</span>
                {lake.temperature_delta != null && (
                  <span className={`text-xs font-mono ${lake.temperature_delta < 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {lake.temperature_delta > 0 ? '↑' : '↓'}{Math.abs(lake.temperature_delta).toFixed(1)}°
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-body">{tr.pressure}</span>
                <span className="text-white font-mono text-sm">{lake.pressure} hPa</span>
                {lake.pressure_delta != null && (
                  <span className={`text-xs font-mono ${lake.pressure_delta < 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {lake.pressure_delta > 0 ? '↑' : '↓'}{Math.abs(lake.pressure_delta).toFixed(1)}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-body">{tr.wind}</span>
                <span className="text-white font-mono text-sm">{lake.wind_speed} km/h</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-body">{tr.rain}</span>
                <span className="text-white font-mono text-sm">{lake.precipitation ?? 0} mm</span>
                <span className="text-xs font-mono text-slate-400">{lake.rain_hours ?? 0}h</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                <span className="block text-[10px] uppercase tracking-widest text-slate-500 font-body">{tr.website}</span>
                {websiteHref ? (
                  <a
                    href={websiteHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-body text-slate-200 hover:text-white"
                  >
                    {lake.website_url ? tr.website : 'Facebook'}
                  </a>
                ) : (
                  <span className="text-sm font-body text-slate-500">{tr.unavailable}</span>
                )}
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                <span className="block text-[10px] uppercase tracking-widest text-slate-500 font-body">{tr.phone}</span>
                {phoneNumbers.length > 0 ? (
                  <div className="flex flex-wrap gap-x-2 gap-y-1">
                    {phoneNumbers.map((phone) => (
                      <a key={phone} href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="text-sm font-body text-slate-200 hover:text-white">
                        {phone}
                      </a>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm font-body text-slate-500">{tr.unavailable}</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
