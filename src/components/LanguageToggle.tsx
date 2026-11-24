import type { Language } from '../types/ecomove';

interface LanguageToggleProps {
  lang: Language;
  onChange: (lang: Language) => void;
}

export function LanguageToggle({ lang, onChange }: LanguageToggleProps) {
  return (
    <div
      className="inline-flex items-center p-0.5 rounded-xl bg-[#E2E8F0] shrink-0"
      role="group"
      aria-label="Language switch"
    >
      <button
        type="button"
        onClick={() => onChange('id')}
        className={`px-2 py-1 min-h-[30px] text-[11px] font-bold rounded-[10px] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
          lang === 'id'
            ? 'bg-white text-[#059669] shadow-xs'
            : 'text-[#64748B] hover:text-[#0F172A]'
        }`}
      >
        ID
      </button>
      <button
        type="button"
        onClick={() => onChange('en')}
        className={`px-2 py-1 min-h-[30px] text-[11px] font-bold rounded-[10px] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
          lang === 'en'
            ? 'bg-white text-[#059669] shadow-xs'
            : 'text-[#64748B] hover:text-[#0F172A]'
        }`}
      >
        EN
      </button>
    </div>
  );
}
