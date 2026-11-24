import { Check, Circle, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { Language } from '../types/ecomove';
import { evaluatePasswordCriteria } from '../utils/authSecurity';

interface PasswordCriteriaChecklistProps {
  lang: Language;
  password: string;
  email?: string;
}

export function PasswordCriteriaChecklist({
  lang,
  password,
  email = '',
}: PasswordCriteriaChecklistProps) {
  const criteria = evaluatePasswordCriteria(password, email);

  const strengthLabel =
    criteria.score <= 2
      ? lang === 'id'
        ? 'Lemah'
        : 'Weak'
      : criteria.score <= 4
      ? lang === 'id'
        ? 'Sedang'
        : 'Fair'
      : criteria.isValid
      ? lang === 'id'
        ? 'Sangat Kuat'
        : 'Strong'
      : lang === 'id'
      ? 'Hampir Memenuhi'
      : 'Almost Ready';

  const strengthColor =
    criteria.score <= 2
      ? 'bg-[#EF4444]'
      : criteria.score <= 4
      ? 'bg-[#F59E0B]'
      : criteria.isValid
      ? 'bg-[#059669]'
      : 'bg-[#10B981]';

  const items = [
    {
      ok: criteria.minLength && criteria.noSpaces,
      label:
        lang === 'id'
          ? 'Minimal 8 karakter & tanpa spasi'
          : 'At least 8 characters & no spaces',
    },
    {
      ok: criteria.hasUpper,
      label: lang === 'id' ? 'Minimal 1 huruf besar (A–Z)' : 'At least 1 uppercase letter (A–Z)',
    },
    {
      ok: criteria.hasLower,
      label: lang === 'id' ? 'Minimal 1 huruf kecil (a–z)' : 'At least 1 lowercase letter (a–z)',
    },
    {
      ok: criteria.hasNumber,
      label: lang === 'id' ? 'Minimal 1 angka (0–9)' : 'At least 1 number (0–9)',
    },
    {
      ok: criteria.hasSymbol,
      label:
        lang === 'id'
          ? 'Minimal 1 simbol (!@#$%^&*)'
          : 'At least 1 symbol (!@#$%^&*)',
    },
    {
      ok: password.length > 0 && criteria.notContainsEmail,
      label:
        lang === 'id'
          ? 'Tidak mengandung nama/alamat email'
          : 'Does not contain your email username',
    },
  ];

  return (
    <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold text-[#475569] flex items-center gap-1">
          {criteria.isValid ? (
            <ShieldCheck className="w-3.5 h-3.5 text-[#059669]" />
          ) : (
            <ShieldAlert className="w-3.5 h-3.5 text-[#D97706]" />
          )}
          <span>{lang === 'id' ? 'Kriteria Password' : 'Password Criteria'}</span>
        </span>
        {password.length > 0 && (
          <span
            className={`text-[10px] font-bold ${
              criteria.isValid ? 'text-[#059669]' : 'text-[#D97706]'
            }`}
          >
            {strengthLabel}
          </span>
        )}
      </div>

      {/* 5-segment strength bar */}
      <div className="grid grid-cols-5 gap-1">
        {[1, 2, 3, 4, 5].map((step) => (
          <div
            key={step}
            className={`h-1 rounded-full transition-colors ${
              password.length > 0 && criteria.score >= step
                ? strengthColor
                : 'bg-[#E2E8F0]'
            }`}
          />
        ))}
      </div>

      <ul className="grid grid-cols-1 gap-1">
        {items.map((item) => (
          <li
            key={item.label}
            className={`flex items-center gap-1.5 text-[10px] ${
              item.ok ? 'text-[#059669] font-semibold' : 'text-[#64748B]'
            }`}
          >
            {item.ok ? (
              <Check className="w-3 h-3 text-[#059669] shrink-0 stroke-[3]" />
            ) : (
              <Circle className="w-2.5 h-2.5 text-[#94A3B8] shrink-0" />
            )}
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
