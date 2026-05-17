interface Props {
  loading: boolean;
  label?: string;
  loadingLabel?: string;
}

export function SubmitButton({ loading, label = 'Adaugă lac', loadingLabel = 'Se salvează...' }: Props) {
  return (
    <button
      type="submit"
      disabled={loading}
      className={`
        w-full py-4 rounded-2xl font-body font-bold text-base
        flex items-center justify-center gap-2.5
        transition-all duration-200 active:scale-[0.98]
        ${loading
          ? 'bg-lake-700/50 text-slate-400 cursor-not-allowed'
          : 'bg-lake-600 hover:bg-lake-500 text-white shadow-lg shadow-lake-900/50'
        }
      `}
    >
      {loading ? (
        <>
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {loadingLabel}
        </>
      ) : (
        <>
          <span className="text-xl">🎣</span>
          {label}
        </>
      )}
    </button>
  );
}
