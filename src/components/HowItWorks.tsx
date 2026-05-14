import { useState } from 'react';
import type { Lang } from '../i18n';
import { t } from '../i18n';

export function HowItWorks({ lang }: { lang: Lang }) {
  const [open, setOpen] = useState(false);
  const tr = t[lang];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left"
      >
        <span className="flex items-center gap-2 text-sm text-slate-300 font-body">
          <span>❓</span> {tr.howItWorks}
        </span>
        <svg className={`w-4 h-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-slate-400 font-body leading-relaxed border-t border-white/5 pt-3">
          {tr.howItWorksText}
        </div>
      )}
    </div>
  );
}
