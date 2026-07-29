import { useState } from 'react';
import { LegalFooter } from '../components/LegalFooter';

const LOCAL_KEYS = [
  'baltozaur_view_mode',
  'baltozaur_international_area',
  'baltozaur_social_posts',
];

export function LegalPage() {
  const [cleared, setCleared] = useState(false);

  const clearLocalData = () => {
    LOCAL_KEYS.forEach((key) => window.localStorage.removeItem(key));
    setCleared(true);
  };

  return (
    <div className="min-h-screen bg-mud-900 text-slate-200 font-body">
      <header className="border-b border-white/10">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <a href="/" className="text-sm text-slate-400 hover:text-white">← Baltozaur</a>
          <h1 className="mt-3 font-display text-4xl tracking-wide text-white">Informații legale</h1>
          <p className="mt-2 text-sm text-slate-400">Versiune în vigoare: 29 iulie 2026</p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-10 px-4 py-8 text-sm leading-7">
        <section className="rounded-2xl border border-lake-500/20 bg-lake-900/20 p-5">
          <h2 className="font-display text-2xl tracking-wide text-white">Despre proiect</h2>
          <p className="mt-3">
            Baltozaur este administrat în România de o persoană fizică, drept proiect personal,
            gratuit și necomercial. Nu vinde produse sau servicii, nu afișează publicitate și nu
            urmărește obținerea de profit.
          </p>
          <p className="mt-3">
            Pentru întrebări, exercitarea drepturilor sau solicitarea datelor complete de
            identificare ale administratorului: {' '}
            <a className="text-lake-300 underline hover:text-lake-200" href="mailto:contact@baltozaur.ro">
              contact@baltozaur.ro
            </a>.
          </p>
        </section>

        <section id="confidentialitate" className="scroll-mt-6 space-y-4">
          <h2 className="font-display text-3xl tracking-wide text-white">Politica de confidențialitate</h2>
          <p>
            Aplicația publică nu solicită cont, nume, adresă de email sau număr de telefon.
            Formularul de sugestii cere doar informații despre balta propusă și solicită să nu fie
            introduse date personale.
          </p>

          <h3 className="text-base font-semibold text-white">Statistici anonime</h3>
          <p>
            Pentru a înțelege utilitatea aplicației sunt păstrate numai valori agregate: numărul de
            vizite și acțiuni, pagina, sursa generală a accesării (de exemplu TikTok, Facebook,
            motor de căutare sau acces direct), tipul general de dispozitiv și țara la nivel
            agregat. Nu se creează profiluri individuale și nu se stochează în analytics adresa IP,
            un identificator de utilizator sau un identificator persistent al dispozitivului.
          </p>

          <h3 className="text-base font-semibold text-white">Localizare</h3>
          <p>
            Localizarea exactă este cerută de browser numai după apăsarea butonului dedicat și este
            folosită în dispozitiv pentru calculul distanței. Coordonatele vizitatorului nu sunt
            trimise și nu sunt salvate de Baltozaur. Preferința de țară sau regiune poate fi salvată
            local în browser.
          </p>

          <h3 className="text-base font-semibold text-white">Date tehnice și furnizori</h3>
          <p>
            Ca la orice site, furnizorii de infrastructură pot prelucra temporar adresa IP și
            informații tehnice strict pentru livrarea paginii, securitate, prevenirea abuzului și
            funcționarea serviciului. Baltozaur folosește Vercel pentru găzduire și Supabase pentru
            baza de date. Harta CARTO/OpenStreetMap se încarcă doar după acordul expres afișat în
            aplicație; furnizorul hărții va primi atunci datele tehnice necesare conexiunii.
          </p>
          <p>
            Temeiul urmărit este interesul legitim pentru securitate și statistici strict agregate,
            precum și consimțământul pentru localizare și încărcarea hărții externe. Datele sunt
            limitate la ceea ce este necesar. Mesajele trimise voluntar prin email sunt folosite
            numai pentru răspuns și sunt șterse când nu mai sunt necesare.
          </p>

          <h3 className="text-base font-semibold text-white">Drepturile tale</h3>
          <p>
            Poți solicita accesul, rectificarea, ștergerea, restricționarea sau opoziția, în măsura
            în care există date care te privesc, folosind adresa de contact de mai sus. Poți depune
            o plângere la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter
            Personal.
          </p>
        </section>

        <section id="stocare-locala" className="scroll-mt-6 space-y-4">
          <h2 className="font-display text-3xl tracking-wide text-white">Cookie-uri și stocare locală</h2>
          <p>
            Baltozaur nu folosește cookie-uri de marketing, publicitate sau profilare și nu folosește
            servicii terțe de analytics. Aplicația poate păstra în localStorage numai preferința de
            afișare, zona aleasă și datele de lucru ale modulului social administrativ. Aceste date
            rămân în browserul tău și sunt necesare doar pentru funcțiile cerute.
          </p>
          <button
            type="button"
            onClick={clearLocalData}
            className="rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2 font-semibold text-white hover:bg-white/[0.09]"
          >
            Șterge preferințele locale
          </button>
          {cleared && <p role="status" className="text-green-300">Preferințele locale au fost șterse.</p>}
        </section>

        <section id="termeni" className="scroll-mt-6 space-y-4">
          <h2 className="font-display text-3xl tracking-wide text-white">Termeni de utilizare</h2>
          <p>
            Prognozele, scorurile, perioadele de hrănire, prețurile, regulile și celelalte informații
            sunt orientative și pot conține întârzieri sau erori. Nu reprezintă o garanție privind
            capturile, accesul ori condițiile de siguranță.
          </p>
          <p>
            Verifică direct cu administratorul bălții regulile, tarifele și programul și consultă
            prognozele și avertizările oficiale înainte de deplasare. Folosești aplicația și
            linkurile externe pe propria răspundere.
          </p>
          <p>
            Când trimiți o sugestie confirmi că nu incluzi date personale și că informațiile despre
            baltă pot fi verificate, corectate și publicate. Conținutul sau linkurile terților rămân
            în responsabilitatea acestora. Serviciul este oferit gratuit, în forma disponibilă, și
            poate fi modificat sau întrerupt.
          </p>
          <p>Acești termeni sunt interpretați conform legislației aplicabile din România și Uniunea Europeană.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-2xl tracking-wide text-white">Surse oficiale</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li><a className="text-lake-300 underline" href="https://eur-lex.europa.eu/eli/reg/2016/679/oj" target="_blank" rel="noreferrer">Regulamentul general privind protecția datelor (GDPR)</a></li>
            <li><a className="text-lake-300 underline" href="https://legislatie.just.ro/Public/DetaliiDocument/288598" target="_blank" rel="noreferrer">Legea nr. 506/2004</a></li>
            <li><a className="text-lake-300 underline" href="https://legislatie.just.ro/Public/DetaliiDocument/77218" target="_blank" rel="noreferrer">Legea nr. 365/2002</a></li>
            <li><a className="text-lake-300 underline" href="https://www.dataprotection.ro/" target="_blank" rel="noreferrer">ANSPDCP</a></li>
          </ul>
        </section>
      </main>

      <LegalFooter />
    </div>
  );
}
