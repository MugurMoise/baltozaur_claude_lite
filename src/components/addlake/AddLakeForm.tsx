import { FormEvent, useState } from 'react';
import { isDevEnvironment, supabase } from '../../lib/supabase';
import { FormField } from './FormField';
import { SubmitButton } from './SubmitButton';
import { Toast } from './Toast';

interface FormState {
  name: string;
  county: string;
  lat: string;
  lon: string;
  website_url: string;
  facebook_url: string;
  phone: string;
  submitter_email: string;
  notes: string;
}

const initialState: FormState = {
  name: '',
  county: '',
  lat: '',
  lon: '',
  website_url: '',
  facebook_url: '',
  phone: '',
  submitter_email: '',
  notes: '',
};

export function AddLakeForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const updateField = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) {
      setToast({ type: 'error', message: 'Supabase nu este configurat.' });
      return;
    }

    const lat = form.lat.trim() ? Number(form.lat) : null;
    const lon = form.lon.trim() ? Number(form.lon) : null;
    if (!form.name.trim()) {
      setToast({ type: 'error', message: 'Completeaza numele baltii.' });
      return;
    }
    if ((lat !== null && !Number.isFinite(lat)) || (lon !== null && !Number.isFinite(lon))) {
      setToast({ type: 'error', message: 'Coordonatele nu par valide.' });
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.functions.invoke('submit-lake-suggestion', {
      body: {
        appEnv: isDevEnvironment ? 'dev' : 'prod',
        name: form.name.trim(),
        county: form.county.trim() || null,
        lat,
        lon,
        website_url: form.website_url.trim() || null,
        facebook_url: form.facebook_url.trim() || null,
        phone: form.phone.trim() || null,
        submitter_email: form.submitter_email.trim() || null,
        notes: form.notes.trim() || null,
      },
    });
    setLoading(false);

    if (error) {
      setToast({ type: 'error', message: error.message });
      return;
    }
    if (data && typeof data === 'object' && 'error' in data) {
      setToast({ type: 'error', message: String(data.error) });
      return;
    }

    setForm(initialState);
    setToast({ type: 'success', message: 'Multumim. Sugestia a fost trimisa pentru verificare.' });
  };

  return (
    <main className="min-h-screen bg-mud-900 text-white font-body px-4 py-6">
      <form onSubmit={submit} className="max-w-xl mx-auto space-y-4">
        <div>
          <a href="/" className="text-sm text-slate-500 hover:text-white">← Baltozaur</a>
          <h1 className="font-display text-3xl tracking-wide mt-2">Sugereaza o balta</h1>
          <p className="mt-2 text-sm text-slate-400">
            Trimite o sugestie pentru review. Nu apare automat in lista publica.
          </p>
        </div>

        <FormField label="Nume balta" required props={{ value: form.name, onChange: (event) => updateField('name', event.target.value) }} />
        <FormField label="Judet / zona" props={{ value: form.county, onChange: (event) => updateField('county', event.target.value) }} />
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Latitudine" props={{ value: form.lat, onChange: (event) => updateField('lat', event.target.value), inputMode: 'decimal' }} />
          <FormField label="Longitudine" props={{ value: form.lon, onChange: (event) => updateField('lon', event.target.value), inputMode: 'decimal' }} />
        </div>
        <FormField label="Site" props={{ value: form.website_url, onChange: (event) => updateField('website_url', event.target.value), placeholder: 'https://...' }} />
        <FormField label="Facebook" props={{ value: form.facebook_url, onChange: (event) => updateField('facebook_url', event.target.value), placeholder: 'https://facebook.com/...' }} />
        <FormField label="Telefon" props={{ value: form.phone, onChange: (event) => updateField('phone', event.target.value) }} />
        <FormField label="Email pentru confirmare" props={{ value: form.submitter_email, onChange: (event) => updateField('submitter_email', event.target.value), type: 'email', placeholder: 'nume@email.ro' }} />
        <FormField
          as="textarea"
          label="Observatii"
          props={{
            value: form.notes,
            onChange: (event) => updateField('notes', event.target.value),
            placeholder: 'Ex: program, taxa, regulile baltii, link Google Maps...',
          }}
        />
        <p className="text-xs leading-relaxed text-slate-500">
          Pentru prevenirea abuzului salvam IP-ul si informatii tehnice ale browserului impreuna cu sugestia.
        </p>
        <SubmitButton loading={loading} label="Trimite sugestia" loadingLabel="Se trimite..." />
      </form>

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </main>
  );
}
