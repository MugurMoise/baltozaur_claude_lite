export function LegalFooter() {
  return (
    <footer className="border-t border-white/10 px-4 py-8 text-center text-xs leading-relaxed text-slate-500">
      <p>Baltozaur este un proiect personal, gratuit și necomercial.</p>
      <nav className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2" aria-label="Informații legale">
        <a href="/legal#confidentialitate" className="hover:text-slate-200">Confidențialitate</a>
        <a href="/legal#stocare-locala" className="hover:text-slate-200">Stocare locală</a>
        <a href="/legal#termeni" className="hover:text-slate-200">Termeni de utilizare</a>
        <a href="mailto:contact@baltozaur.ro" className="hover:text-slate-200">Contact</a>
      </nav>
    </footer>
  );
}
