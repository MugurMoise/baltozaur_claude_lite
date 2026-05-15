import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface BaseProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

interface InputProps extends BaseProps {
  as?: 'input';
  props: InputHTMLAttributes<HTMLInputElement>;
}

interface TextareaProps extends BaseProps {
  as: 'textarea';
  props: TextareaHTMLAttributes<HTMLTextAreaElement>;
}

type Props = InputProps | TextareaProps;

export function FormField({ label, error, hint, required, as: as_ = 'input', props }: Props) {
  const baseClass = `
    w-full bg-white/5 border rounded-2xl px-4 py-3.5
    text-white placeholder-slate-500 font-body text-base
    focus:outline-none focus:ring-2 transition-all
    ${error
      ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500/70'
      : 'border-white/10 focus:ring-lake-500/30 focus:border-lake-500/50'
    }
  `;

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-body font-medium text-slate-300 flex items-center gap-1">
        {label}
        {required && <span className="text-red-400">*</span>}
      </label>

      {as_ === 'textarea' ? (
        <textarea
          {...(props as TextareaHTMLAttributes<HTMLTextAreaElement>)}
          className={`${baseClass} resize-none min-h-[100px]`}
        />
      ) : (
        <input
          {...(props as InputHTMLAttributes<HTMLInputElement>)}
          className={baseClass}
        />
      )}

      {hint && !error && (
        <p className="text-xs text-slate-500 font-body px-1">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-red-400 font-body px-1 flex items-center gap-1">
          <span>⚠</span> {error}
        </p>
      )}
    </div>
  );
}
