import { useEffect } from 'react';

interface Props {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

export function Toast({ message, type, onClose }: Props) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`
      fixed bottom-6 left-4 right-4 z-[1000] max-w-md mx-auto
      flex items-center gap-3 px-4 py-4 rounded-2xl shadow-xl
      animate-slide-up font-body
      ${type === 'success'
        ? 'bg-green-500/20 border border-green-500/40 text-green-300'
        : 'bg-red-500/20 border border-red-500/40 text-red-300'
      }
    `}>
      <span className="text-2xl shrink-0">
        {type === 'success' ? '✅' : '❌'}
      </span>
      <span className="flex-1 text-sm font-medium">{message}</span>
      <button
        onClick={onClose}
        className="shrink-0 text-slate-400 hover:text-white transition-colors text-xl leading-none"
      >
        ×
      </button>
    </div>
  );
}
