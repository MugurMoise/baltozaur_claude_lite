import { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { FormField } from './FormField';
import { MapPicker } from './MapPicker';
import { SubmitButton } from './SubmitButton';
import { Toast } from './Toast';

type LakeType = 'commercial' | 'wild' | 'private';

interface FormData {
  name: string;
  county: string;
  lat: string;
  lon: string;
  distance_km: string;
  lake_type: LakeType;
  description: string;
  website_url: string;
  facebook_url: string;
}

interface FormErrors {
  name?: string;
  county?: string;
  lat?: string;
  lon?: string;
  distance_km?: string;
  lake_type?: string;
  general?: string;
}

interface ToastState {
  message: string;
  type: 'success' | 'error';
}

const EMPTY_FORM: FormData = {
  name: '',
  county: '',
  lat: '',
  lon: '',
  distance_km: '',
  lake_type: 'commercial',
  description: '',
  website_url: '',
  facebook_url: '',
};

const LAKE_TYPE_OPTIONS: { value: LakeType; label: string; icon: string; desc: string }[] = [
  { value: 'commercial', label: 'Comercial',  icon: '🏪', desc: 'Baltă cu plată, facilități' },
  { value: 'wild',       label: 'Sălbatic',   icon: '🌿', desc: 'Apă naturală, fără amenajări' },
  { value: 'private',    label: 'Privat',      icon: '🔒', desc: 'Acces restricționat' },
];

const COUNTIES = [
  'Ilfov','Giurgiu','Dâmbovița','Prahova','Ialomița','Călărași',
  'Argeș','Teleorman','Buzău','Brăila','Galați','Vrancea',
  'Alba','Arad','Bacău','Bihor','Bistrița-Năsăud','Botoșani',
  'Brașov','Caraș-Severin','Cluj','Constanța','Covasna','Dolj',
  'Gorj','Harghita','Hunedoara','Mehedinți','Mureș','Neamț',
  'Olt','Satu Mare','Sălaj','Sibiu','Suceava','Timiș',
  'Tulcea','Vaslui','Vâlcea','Iași','Maramureș',
  'București',
].sort();

function validate(form: FormData): FormErrors {
  const errors: FormErrors = {};

  if (!form.name.trim()) errors.name = 'Numele lacului este obligatoriu';
  else if (form.name.trim().length < 3) errors.name = 'Minim 3 caractere';

  if (!form.county) errors.county = 'Județul este obligatoriu';

  if (!form.lat) {
    errors.lat = 'Latitudinea este obligatorie';
  } else {
    const v = parseFloat(form.lat);
    if (isNaN(v) || v < 43 || v > 48.5) errors.lat = 'Latitudine invalidă (43–48.5 pentru România)';
  }

  if (!form.lon) {
    errors.lon = 'Longitudinea este obligatorie';
  } else {
    const v = parseFloat(form.lon);
    if (isNaN(v) || v < 20 || v > 30) errors.lon = 'Longitudine invalidă (20–30 pentru România)';
  }

  if (!form.distance_km) {
    errors.distance_km = 'Distanța este obligatorie';
  } else {
    const v = parseFloat(form.distance_km);
    if (isNaN(v) || v < 0 || v > 500) errors.distance_km = 'Distanță invalidă (0–500 km)';
  }

  return errors;
}

export function AddLakeForm() {
  const [form, setForm]       = useState<FormData>(EMPTY_FORM);
  const [errors, setErrors]   = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast]     = useState<ToastState | null>(null);
  const [locating, setLocating] = useState(false);

  const set = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    if (errors[field as keyof FormErrors]) {
      setErrors(ev => ({ ...ev, [field]: undefined }));
    }
  };

  const handleMapChange = useCallback((lat: number, lon: number) => {
    setForm(f => ({ ...f, lat: String(lat), lon: String(lon) }));
    setErrors(e => ({ ...e, lat: undefined, lon: undefined }));
  }, []);

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      setToast({ message: 'Geolocalizarea nu este suportată de browser', type: 'error' });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = +pos.coords.latitude.toFixed(6);
        const lon = +pos.coords.longitude.toFixed(6);
        setForm(f => ({ ...f, lat: String(lat), lon: String(lon) }));
        setErrors(e => ({ ...e, lat: undefined, lon: undefined }));
        setLocating(false);
      },
      () => {
        setToast({ message: 'Nu s-a putut obține locația. Verificați permisiunile.', type: 'error' });
        setLocating(false);
      },
      { timeout: 10000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      // Scroll to first error
      document.querySelector('[data-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (!supabase) {
      setToast({ message: 'Supabase nu este configurat', type: 'error' });
      return;
    }

    setLoading(true);
    setErrors({});

    const { error } = await supabase.from('lakes').insert({
      name:         form.name.trim(),
      county:       form.county,
      lat:          parseFloat(form.lat),
      lon:          parseFloat(form.lon),
      distance_km:  parseFloat(form.distance_km),
      lake_type:    form.lake_type,
      description:  form.description.trim() || null,
      website_url:  form.website_url.trim() || null,
      facebook_url: form.facebook_url.trim() || null,
    });

    setLoading(false);

    if (error) {
      console.error(error);
      setErrors({ general: error.message });
      setToast({ message: `Eroare: ${error.message}`, type: 'error' });
    } else {
      setToast({ message: `Lacul "${form.name}" a fost adăugat cu succes! 🎣`, type: 'success' });
      setForm(EMPTY_FORM);
    }
  };

  const latNum = form.lat ? parseFloat(form.lat) : null;
  const lonNum = form.lon ? parseFloat(form.lon) : null;
  const validCoords = latNum && lonNum && !isNaN(latNum) && !isNaN(lonNum);

  return (
    <div className="min-h-screen bg-mud-900 text-white font-body">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-lake-900/30 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-lake-800/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <a href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm font-body mb-4 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Înapoi la Baltozaur
          </a>
          <div className="flex items-center gap-3">
            <span className="text-4xl">🦕</span>
            <div>
              <h1 className="font-display text-3xl text-white tracking-wider">ADAUGĂ LAC</h1>
              <p className="text-sm text-slate-400 font-body mt-0.5">Contribuie la harta pescuitului</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>

          {/* General error */}
          {errors.general && (
            <div className="rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3 text-sm font-body flex items-center gap-2">
              <span>⚠️</span> {errors.general}
            </div>
          )}

          {/* ── Informații de bază ── */}
          <section className="bg-white/[0.03] border border-white/8 rounded-3xl p-5 space-y-4">
            <h2 className="font-display text-lg text-white tracking-wide flex items-center gap-2">
              <span>📋</span> Informații de bază
            </h2>

            <FormField
              label="Numele lacului"
              required
              error={errors.name}
              props={{
                type: 'text',
                placeholder: 'ex: Lacul Snagov',
                value: form.name,
                onChange: set('name'),
              }}
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-body font-medium text-slate-300 flex items-center gap-1">
                Județ <span className="text-red-400">*</span>
              </label>
              <select
                value={form.county}
                onChange={set('county')}
                className={`
                  w-full bg-white/5 border rounded-2xl px-4 py-3.5
                  text-white font-body text-base
                  focus:outline-none focus:ring-2 transition-all
                  ${errors.county
                    ? 'border-red-500/50 focus:ring-red-500/30'
                    : 'border-white/10 focus:ring-lake-500/30 focus:border-lake-500/50'
                  }
                `}
              >
                <option value="" className="bg-mud-800">Selectează județul</option>
                {COUNTIES.map(c => (
                  <option key={c} value={c} className="bg-mud-800">{c}</option>
                ))}
              </select>
              {errors.county && (
                <p className="text-xs text-red-400 font-body px-1 flex items-center gap-1">
                  <span>⚠</span> {errors.county}
                </p>
              )}
            </div>

            <FormField
              label="Distanța față de București (km)"
              required
              error={errors.distance_km}
              hint="Distanța aproximativă rutieră"
              props={{
                type: 'number',
                placeholder: 'ex: 45',
                value: form.distance_km,
                onChange: set('distance_km'),
                min: '0',
                max: '500',
                step: '0.1',
              }}
            />
          </section>

          {/* ── Tip lac ── */}
          <section className="bg-white/[0.03] border border-white/8 rounded-3xl p-5 space-y-4">
            <h2 className="font-display text-lg text-white tracking-wide flex items-center gap-2">
              <span>🏷️</span> Tipul lacului
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {LAKE_TYPE_OPTIONS.map(({ value, label, icon, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, lake_type: value }))}
                  className={`
                    flex flex-col items-center gap-2 p-3 rounded-2xl border text-center
                    transition-all duration-200 active:scale-95
                    ${form.lake_type === value
                      ? 'bg-lake-600/30 border-lake-500/60 text-white'
                      : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-white hover:bg-white/[0.06]'
                    }
                  `}
                >
                  <span className="text-2xl">{icon}</span>
                  <span className="font-body font-semibold text-sm">{label}</span>
                  <span className="font-body text-[10px] text-slate-500 leading-tight">{desc}</span>
                </button>
              ))}
            </div>
          </section>

          {/* ── Locație ── */}
          <section className="bg-white/[0.03] border border-white/8 rounded-3xl p-5 space-y-4">
            <h2 className="font-display text-lg text-white tracking-wide flex items-center gap-2">
              <span>📍</span> Locație
            </h2>

            {/* Use my location button */}
            <button
              type="button"
              onClick={handleUseLocation}
              disabled={locating}
              className="w-full flex items-center justify-center gap-2 bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/25 text-emerald-300 rounded-2xl py-3 font-body font-medium text-sm transition-all disabled:opacity-50"
            >
              {locating ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Se obține locația...
                </>
              ) : (
                <>📱 Folosește locația mea actuală</>
              )}
            </button>

            {/* Map */}
            <MapPicker
              lat={validCoords ? latNum : null}
              lon={validCoords ? lonNum : null}
              onChange={handleMapChange}
            />

            {/* Manual coords */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Latitudine"
                required
                error={errors.lat}
                props={{
                  type: 'number',
                  placeholder: '44.7022',
                  value: form.lat,
                  onChange: set('lat'),
                  step: '0.000001',
                }}
              />
              <FormField
                label="Longitudine"
                required
                error={errors.lon}
                props={{
                  type: 'number',
                  placeholder: '26.1481',
                  value: form.lon,
                  onChange: set('lon'),
                  step: '0.000001',
                }}
              />
            </div>
            <p className="text-xs text-slate-500 font-body text-center">
              Apasă pe hartă sau trage markerul pentru a seta coordonatele
            </p>
          </section>

          {/* ── Detalii extra ── */}
          <section className="bg-white/[0.03] border border-white/8 rounded-3xl p-5 space-y-4">
            <h2 className="font-display text-lg text-white tracking-wide flex items-center gap-2">
              <span>📝</span> Detalii suplimentare
              <span className="text-xs text-slate-500 font-body font-normal normal-case">(opțional)</span>
            </h2>

            <FormField
              as="textarea"
              label="Descriere"
              props={{
                placeholder: 'Informații despre baltă, acces, facilități...',
                value: form.description,
                onChange: set('description'),
                rows: 3,
              }}
            />

            <FormField
              label="Website"
              props={{
                type: 'url',
                placeholder: 'https://...',
                value: form.website_url,
                onChange: set('website_url'),
              }}
            />

            <FormField
              label="Pagină Facebook"
              props={{
                type: 'url',
                placeholder: 'https://facebook.com/...',
                value: form.facebook_url,
                onChange: set('facebook_url'),
              }}
            />
          </section>

          <SubmitButton loading={loading} />

          <p className="text-center text-xs text-slate-600 font-body pb-4">
            Lacurile adăugate sunt verificate înainte de publicare
          </p>
        </form>
      </div>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
