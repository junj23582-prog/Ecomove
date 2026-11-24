import { useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  GraduationCap,
  Home,
  Info,
  KeyRound,
  Leaf,
  Loader2,
  Lock,
  Mail,
  ScanLine,
  ShieldCheck,
  Upload,
  User,
  X,
} from 'lucide-react';
import type { KtmExtractedInfo, Language, UserProfile, UserRole } from '../types/ecomove';
import { DEFAULT_USER_TEMPLATE } from '../data/mockData';
import { getT } from '../i18n/translations';
import { playConfirmTone } from '../utils/audio';
import {
  evaluatePasswordCriteria,
  getStoredAccount,
  hashPassword,
  isGmailAddress,
  isValidEmailFormat,
  saveStoredAccountRecord,
  verifyPassword,
} from '../utils/authSecurity';
import {
  createSamplePolteqKtmDataUrl,
  verifyStudentCardImage,
} from '../utils/ktmVerifier';
import { LanguageToggle } from './LanguageToggle';
import { KtmScannerModal } from './KtmScannerModal';
import { PasswordCriteriaChecklist } from './PasswordCriteriaChecklist';

interface AuthViewProps {
  lang: Language;
  onChangeLang: (lang: Language) => void;
  onAuthenticated: (user: UserProfile) => void;
}

function deriveNameFromEmail(identifier: string): string {
  const clean = identifier.trim();
  if (!clean) return 'Pengguna EcoMove';
  const localPart = clean.includes('@') ? clean.split('@')[0] : clean;
  const words = localPart
    .split(/[._-]+/)
    .map((w) => w.trim())
    .filter(Boolean);
  if (words.length === 0) return clean;
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function AuthView({ lang, onChangeLang, onAuthenticated }: AuthViewProps) {
  const t = getT(lang);
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('household');
  const [ktmFileName, setKtmFileName] = useState('');
  const [ktmPreviewUrl, setKtmPreviewUrl] = useState('');
  const [ktmInfo, setKtmInfo] = useState<KtmExtractedInfo | null>(null);
  const [verifyingKtm, setVerifyingKtm] = useState(false);
  const [copiedKtmSummary, setCopiedKtmSummary] = useState(false);
  const [showKtmScanner, setShowKtmScanner] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [suggestGmailActions, setSuggestGmailActions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Google OAuth sheet state
  const [showGoogleSheet, setShowGoogleSheet] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('junj23582@gmail.com');
  const [googleName, setGoogleName] = useState('Junj23582');
  const [googleNameEdited, setGoogleNameEdited] = useState(false);
  const [googleRole, setGoogleRole] = useState<UserRole>('student');

  const runKtmVerification = async (source: File | string, fileName: string) => {
    setErrorMsg('');
    setVerifyingKtm(true);
    try {
      const result = await verifyStudentCardImage({ source, lang });
      if (!result.isStudentCard || !result.ktmInfo) {
        setKtmFileName('');
        setKtmPreviewUrl('');
        setKtmInfo(null);
        setErrorMsg(
          result.rejectionReason ||
            (lang === 'id'
              ? 'Hanya Kartu Tanda Mahasiswa (KTM) atau Kartu Pelajar yang dapat terdeteksi.'
              : 'Only Student ID cards (KTM / Kartu Pelajar) are accepted.')
        );
        return;
      }

      setKtmFileName(fileName);
      setKtmPreviewUrl(result.previewUrl);
      setKtmInfo(result.ktmInfo);
      setCopiedKtmSummary(true);
      setTimeout(() => setCopiedKtmSummary(false), 2500);
      if (!fullName.trim() && result.ktmInfo.studentName) {
        setFullName(result.ktmInfo.studentName);
      }
      playConfirmTone();
    } catch (err) {
      setKtmFileName('');
      setKtmPreviewUrl('');
      setKtmInfo(null);
      setErrorMsg(
        err instanceof Error
          ? err.message
          : lang === 'id'
          ? 'Gagal memverifikasi KTM / Kartu Pelajar.'
          : 'Failed to verify Student ID.'
      );
    } finally {
      setVerifyingKtm(false);
    }
  };

  const handleKtmUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    try {
      await runKtmVerification(file, file.name);
    } finally {
      input.value = '';
    }
  };

  const handleSampleKtm = async () => {
    const sampleUrl = createSamplePolteqKtmDataUrl(
      fullName || deriveNameFromEmail(email)
    );
    if (!sampleUrl) return;
    await runKtmVerification(sampleUrl, 'KTM_POLTEQ_2026.jpg');
  };

  const handleCopyExtractedKtm = () => {
    if (!ktmInfo) return;
    navigator.clipboard?.writeText(ktmInfo.copiedSummary).catch(() => {});
    setCopiedKtmSummary(true);
    setTimeout(() => setCopiedKtmSummary(false), 2200);
  };

  const openGoogleModalWithCurrentEmail = () => {
    if (fullName.trim()) {
      setGoogleName(fullName.trim());
      setGoogleNameEdited(true);
    }
    const clean = email.trim();
    if (clean && clean.includes('@')) {
      setGoogleEmail(clean);
      const existing = getStoredAccount(clean);
      if (existing) {
        setGoogleName(existing.profile.name);
        setGoogleNameEdited(true);
        setGoogleRole(existing.profile.role);
      } else if (!fullName.trim()) {
        setGoogleName(deriveNameFromEmail(clean));
      }
    }
    setShowGoogleSheet(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    setSuggestGmailActions(false);

    const cleanEmail = email.trim();
    if (!cleanEmail || !isValidEmailFormat(cleanEmail)) {
      setErrorMsg(
        lang === 'id'
          ? 'Mohon masukkan alamat Email / Gmail yang valid (contoh: nama@gmail.com).'
          : 'Please enter a valid Email / Gmail address (e.g. name@gmail.com).'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'register') {
        const cleanName = fullName.trim();
        if (!cleanName) {
          setErrorMsg(
            lang === 'id' ? 'Mohon isi nama lengkap Anda.' : 'Please enter your full name.'
          );
          return;
        }

        const existing = getStoredAccount(cleanEmail);
        if (existing?.passwordHash) {
          setErrorMsg(
            lang === 'id'
              ? 'Email / Gmail ini sudah terdaftar. Silakan masuk di tab Masuk atau atur ulang password.'
              : 'This Email / Gmail is already registered. Please sign in or reset your password.'
          );
          return;
        }

        const criteria = evaluatePasswordCriteria(password, cleanEmail);
        if (!criteria.isValid) {
          setErrorMsg(t.passwordCriteriaError);
          return;
        }
        if (password !== confirmPassword) {
          setErrorMsg(t.passwordMismatchError);
          return;
        }

        if (role === 'student' && (!ktmPreviewUrl || !ktmInfo)) {
          setErrorMsg(t.ktmError);
          return;
        }

        const { salt, hash } = await hashPassword(password);
        const newProfile: UserProfile = {
          ...(existing?.profile ?? DEFAULT_USER_TEMPLATE),
          id: existing?.profile.id ?? `usr-${Date.now()}`,
          name: cleanName,
          email: cleanEmail,
          role,
          ktmVerified: role === 'student' && Boolean(ktmInfo),
          ktmFileName: role === 'student' ? ktmFileName : undefined,
          ktmPreviewUrl: role === 'student' ? ktmPreviewUrl : undefined,
          ktmInfo: role === 'student' ? ktmInfo ?? undefined : undefined,
          authProvider: existing?.profile.authProvider ?? 'email',
          ecoPoints: existing?.profile.ecoPoints ?? (role === 'student' ? 150 : 120),
        };

        saveStoredAccountRecord({
          profile: newProfile,
          passwordSalt: salt,
          passwordHash: hash,
          updatedAt: Date.now(),
        });

        playConfirmTone();
        onAuthenticated(newProfile);
        return;
      }

      if (mode === 'reset') {
        const criteria = evaluatePasswordCriteria(password, cleanEmail);
        if (!criteria.isValid) {
          setErrorMsg(t.passwordCriteriaError);
          return;
        }
        if (password !== confirmPassword) {
          setErrorMsg(t.passwordMismatchError);
          return;
        }

        const existing = getStoredAccount(cleanEmail);
        const { salt, hash } = await hashPassword(password);
        const updatedProfile: UserProfile = existing
          ? existing.profile
          : {
              ...DEFAULT_USER_TEMPLATE,
              id: `usr-${Date.now()}`,
              name: deriveNameFromEmail(cleanEmail),
              email: cleanEmail,
              role: 'household',
              ktmVerified: false,
              ktmFileName: undefined,
              ktmPreviewUrl: undefined,
              authProvider: isGmailAddress(cleanEmail) ? 'google' : 'email',
            };

        saveStoredAccountRecord({
          profile: updatedProfile,
          passwordSalt: salt,
          passwordHash: hash,
          updatedAt: Date.now(),
        });

        playConfirmTone();
        setPassword('');
        setConfirmPassword('');
        setMode('login');
        setInfoMsg(
          lang === 'id'
            ? `Password untuk ${cleanEmail} berhasil disimpan. Silakan masuk menggunakan password baru Anda.`
            : `Password for ${cleanEmail} has been saved. Please sign in with your new password.`
        );
        return;
      }

      // LOGIN MODE
      if (!password) {
        setErrorMsg(
          lang === 'id' ? 'Mohon masukkan password akun Anda.' : 'Please enter your password.'
        );
        return;
      }

      const stored = getStoredAccount(cleanEmail);

      // Account exists with stored salted PBKDF2 password hash
      if (stored?.passwordHash && stored?.passwordSalt) {
        const isMatch = await verifyPassword(
          password,
          stored.passwordSalt,
          stored.passwordHash
        );
        if (!isMatch) {
          setErrorMsg(t.wrongPasswordError);
          return;
        }
        playConfirmTone();
        onAuthenticated(stored.profile);
        return;
      }

      // Account registered via Google OAuth (no EcoMove password set) or Gmail not yet registered
      if (isGmailAddress(cleanEmail) || stored?.profile.authProvider === 'google') {
        setSuggestGmailActions(true);
        setErrorMsg(
          lang === 'id'
            ? `Akun ${cleanEmail} belum memiliki password khusus EcoMove. Untuk akun Gmail, verifikasi resmi dilakukan lewat "Lanjutkan dengan Google", atau buat password khusus EcoMove terlebih dahulu.`
            : `${cleanEmail} does not have an EcoMove password yet. Use "Continue with Google" for Gmail authentication, or set an EcoMove password first.`
        );
        return;
      }

      setErrorMsg(
        lang === 'id'
          ? 'Akun belum terdaftar. Silakan pilih tab Daftar Baru untuk membuat akun & password.'
          : 'Account not found. Please switch to Register to create an account & password.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleEmailChange = (nextEmail: string) => {
    setGoogleEmail(nextEmail);
    if (!googleNameEdited) {
      setGoogleName(deriveNameFromEmail(nextEmail));
    }
  };

  const handleGoogleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleanEmail = googleEmail.trim() || 'junj23582@gmail.com';
    const cleanName = googleName.trim() || deriveNameFromEmail(cleanEmail);
    const existing = getStoredAccount(cleanEmail);

    const profile: UserProfile = {
      ...(existing?.profile ?? DEFAULT_USER_TEMPLATE),
      id: existing?.profile.id ?? `usr-google-${Date.now()}`,
      name: cleanName,
      email: cleanEmail,
      role: googleRole,
      ktmVerified:
        googleRole === 'student' ? Boolean(existing?.profile.ktmVerified) : false,
      ktmFileName:
        googleRole === 'student' ? existing?.profile.ktmFileName : undefined,
      ktmPreviewUrl:
        googleRole === 'student' ? existing?.profile.ktmPreviewUrl : undefined,
      ktmInfo: googleRole === 'student' ? existing?.profile.ktmInfo : undefined,
      authProvider: 'google',
    };

    saveStoredAccountRecord({
      profile,
      passwordSalt: existing?.passwordSalt,
      passwordHash: existing?.passwordHash,
      updatedAt: Date.now(),
    });

    playConfirmTone();
    setShowGoogleSheet(false);
    onAuthenticated(profile);
  };

  const showCriteriaBox = mode === 'register' || mode === 'reset';

  return (
    <div className="flex-1 flex flex-col bg-[#F4F9F6] overflow-y-auto mobile-scroll relative">
      {/* Vibrant Curved Emerald Hero Header */}
      <div className="bg-gradient-to-br from-[#059669] via-[#10B981] to-[#0D9488] text-white px-5 pt-3 pb-10 relative overflow-hidden shrink-0">
        <div
          className="absolute -right-8 -bottom-10 w-36 h-36 rounded-full bg-white/10 pointer-events-none"
          aria-hidden="true"
        />
        <header className="flex items-center justify-between gap-2 mb-4 relative z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white text-[#059669] flex items-center justify-center shadow-xs">
              <Leaf className="w-4 h-4" />
            </div>
            <span className="font-display text-base font-bold tracking-tight">EcoMove</span>
          </div>
          <LanguageToggle lang={lang} onChange={onChangeLang} />
        </header>

        <div className="space-y-1 relative z-10">
          <h1 className="font-display text-lg font-bold leading-snug text-balance">
            {t.authTitle}
          </h1>
          <p className="text-[11px] text-[#ECFDF5] leading-relaxed">{t.authSubtitle}</p>
        </div>
      </div>

      {/* Overlapping Rounded Auth Sheet */}
      <div className="px-4 -mt-5 pb-6 flex-1 relative z-10">
        <div className="bg-white rounded-3xl border border-[#DCEFE5] p-4 space-y-4 shadow-md">
          {/* Tab Switch */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-[#F1F5F9] rounded-xl">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg('');
                setInfoMsg('');
                setSuggestGmailActions(false);
                setPassword('');
                setConfirmPassword('');
              }}
              className={`py-2 min-h-[40px] text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                mode === 'login'
                  ? 'bg-[#059669] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              {t.tabLogin}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMsg('');
                setInfoMsg('');
                setSuggestGmailActions(false);
                setPassword('');
                setConfirmPassword('');
              }}
              className={`py-2 min-h-[40px] text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                mode === 'register'
                  ? 'bg-[#059669] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              {t.tabRegister}
            </button>
          </div>

          {mode === 'reset' && (
            <div className="p-2.5 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <KeyRound className="w-4 h-4 text-[#059669] shrink-0" />
                <p className="text-[11px] font-bold text-[#065F46] truncate">
                  {lang === 'id' ? 'Atur / Perbarui Password Akun' : 'Set / Reset Account Password'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg('');
                  setPassword('');
                  setConfirmPassword('');
                }}
                className="text-[10px] font-bold text-[#059669] underline shrink-0 cursor-pointer"
              >
                {t.tabLogin}
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'register' && (
              <div>
                <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                  {t.fullNameLabel}
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={lang === 'id' ? 'Nama lengkap Anda' : 'Your full name'}
                    className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] focus:outline-none focus:border-[#10B981]"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                {mode === 'login' ? t.emailOrPhoneLabel : t.emailLabel}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrorMsg('');
                    setSuggestGmailActions(false);
                  }}
                  placeholder="nama@gmail.com"
                  className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] focus:outline-none focus:border-[#10B981]"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label className="block text-[11px] font-semibold text-[#475569]">
                  {mode === 'reset'
                    ? lang === 'id'
                      ? 'Password Baru'
                      : 'New Password'
                    : t.passwordLabel}
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('reset');
                      setErrorMsg('');
                      setInfoMsg('');
                      setSuggestGmailActions(false);
                      setPassword('');
                      setConfirmPassword('');
                    }}
                    className="text-[10px] font-bold text-[#059669] hover:underline cursor-pointer"
                  >
                    {t.forgotOrSetPasswordLink}
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    mode === 'login'
                      ? lang === 'id'
                        ? 'Masukkan password akun Anda'
                        : 'Enter your account password'
                      : lang === 'id'
                      ? 'Buat password kuat (min. 8 karakter)'
                      : 'Create strong password (min. 8 chars)'
                  }
                  className="w-full min-h-[44px] pl-9 pr-10 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] focus:outline-none focus:border-[#10B981]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#64748B] hover:text-[#0F172A] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {showCriteriaBox && (
              <>
                <PasswordCriteriaChecklist lang={lang} password={password} email={email} />

                <div>
                  <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                    {t.confirmPasswordLabel}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={
                        lang === 'id' ? 'Ulangi password Anda' : 'Re-enter your password'
                      }
                      className="w-full min-h-[44px] pl-9 pr-10 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] focus:outline-none focus:border-[#10B981]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#64748B] hover:text-[#0F172A] cursor-pointer"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && confirmPassword !== password && (
                    <p className="text-[10px] font-semibold text-[#DC2626] mt-1">
                      {t.passwordMismatchError}
                    </p>
                  )}
                </div>
              </>
            )}

            {mode === 'register' && (
              <div className="space-y-2.5 pt-1">
                <label className="block text-[11px] font-semibold text-[#475569]">
                  {t.categoryLabel}
                </label>

                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRole('household');
                      setErrorMsg('');
                    }}
                    className={`p-3 rounded-xl border text-left transition-colors cursor-pointer flex items-center gap-2.5 ${
                      role === 'household'
                        ? 'bg-[#ECFDF5] border-[#10B981] text-[#059669]'
                        : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#0F172A]'
                    }`}
                  >
                    <Home className="w-4 h-4 shrink-0" />
                    <div>
                      <p className="text-xs font-bold">{t.roleHousehold}</p>
                      <p className="text-[11px] text-[#64748B]">{t.roleHouseholdDesc}</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRole('student');
                      setErrorMsg('');
                    }}
                    className={`p-3 rounded-xl border text-left transition-colors cursor-pointer flex items-center gap-2.5 ${
                      role === 'student'
                        ? 'bg-[#ECFDF5] border-[#10B981] text-[#059669]'
                        : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#0F172A]'
                    }`}
                  >
                    <GraduationCap className="w-4 h-4 shrink-0" />
                    <div>
                      <p className="text-xs font-bold">{t.roleStudent}</p>
                      <p className="text-[11px] text-[#64748B]">{t.roleStudentDesc}</p>
                    </div>
                  </button>
                </div>

                {role === 'student' && (
                  <div className="p-3 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] space-y-2.5">
                    <div>
                      <p className="text-[11px] font-bold text-[#0F172A]">
                        {t.ktmUploadLabel} <span className="text-[#DC2626]">*</span>
                      </p>
                      <p className="text-[11px] text-[#64748B]">
                        {lang === 'id'
                          ? 'Upload atau scan foto KTM / Kartu Pelajar. Keterangan kampus & NIM terdeteksi dan disalin otomatis.'
                          : 'Upload or scan Student ID photo. Institution & ID details are detected and auto-copied.'}
                      </p>
                    </div>

                    {verifyingKtm ? (
                      <div className="py-5 px-3 rounded-xl bg-white border border-[#A7F3D0] flex flex-col items-center justify-center gap-2 text-center">
                        <Loader2 className="w-5 h-5 text-[#059669] animate-spin" />
                        <p className="text-[11px] font-bold text-[#065F46]">
                          {lang === 'id'
                            ? 'Mendeteksi KTM / Kartu Pelajar & menyalin keterangan...'
                            : 'Detecting Student ID & extracting card details...'}
                        </p>
                      </div>
                    ) : !ktmPreviewUrl || !ktmInfo ? (
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => setShowKtmScanner(true)}
                          className="w-full min-h-[42px] rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                        >
                          <ScanLine className="w-4 h-4" />
                          <span>
                            {lang === 'id' ? 'Scan KTM / Kartu Pelajar' : 'Scan Student ID (Camera)'}
                          </span>
                        </button>

                        <div className="grid grid-cols-2 gap-2">
                          <label className="flex items-center justify-center gap-1.5 px-2.5 py-2 min-h-[38px] rounded-xl border border-dashed border-[#10B981] bg-white cursor-pointer text-center">
                            <Upload className="w-3.5 h-3.5 text-[#059669] shrink-0" />
                            <span className="text-[11px] font-semibold text-[#475569] truncate">
                              {lang === 'id' ? 'Upload Galeri' : 'Upload File'}
                            </span>
                            <input
                              type="file"
                              accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif"
                              onChange={handleKtmUpload}
                              className="sr-only"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={handleSampleKtm}
                            className="min-h-[38px] px-2.5 rounded-xl bg-[#D1FAE5] text-[#059669] text-[11px] font-bold hover:bg-[#A7F3D0] transition-colors cursor-pointer truncate"
                          >
                            {lang === 'id' ? 'Contoh KTM Polteq' : 'Sample Polteq ID'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="relative rounded-xl overflow-hidden border border-[#A7F3D0] bg-white">
                          <img
                            src={ktmPreviewUrl}
                            alt="Preview KTM"
                            referrerPolicy="no-referrer"
                            className="w-full h-28 object-contain"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setKtmFileName('');
                              setKtmPreviewUrl('');
                              setKtmInfo(null);
                              setCopiedKtmSummary(false);
                            }}
                            aria-label="Remove KTM"
                            className="absolute top-1.5 right-1.5 w-7 h-7 rounded-lg bg-white/90 border border-[#E2E8F0] flex items-center justify-center text-[#475569] cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="rounded-xl bg-white border border-[#A7F3D0] p-2.5 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[11px] font-bold text-[#059669] flex items-center gap-1 min-w-0">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">
                                {ktmInfo.cardType} Terdeteksi
                              </span>
                            </p>
                            <button
                              type="button"
                              onClick={handleCopyExtractedKtm}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#ECFDF5] hover:bg-[#D1FAE5] text-[#059669] text-[10px] font-bold cursor-pointer shrink-0"
                            >
                              {copiedKtmSummary ? (
                                <>
                                  <Check className="w-3 h-3" />
                                  <span>{lang === 'id' ? 'Disalin' : 'Copied'}</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>{lang === 'id' ? 'Salin Data' : 'Copy Info'}</span>
                                </>
                              )}
                            </button>
                          </div>

                          <div className="text-[11px] space-y-1 border-t border-[#F1F5F9] pt-1.5">
                            <div>
                              <span className="text-[10px] text-[#64748B] block">
                                {lang === 'id' ? 'Kampus / Sekolah' : 'Institution'}
                              </span>
                              <span className="font-bold text-[#0F172A] break-words">
                                {ktmInfo.campusName || '-'}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="text-[10px] text-[#64748B] block">
                                  NIM / NISN
                                </span>
                                <span className="font-mono-tabular font-bold text-[#059669] break-all">
                                  {ktmInfo.nim || '-'}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-[#64748B] block">
                                  {lang === 'id' ? 'Nama' : 'Name'}
                                </span>
                                <span className="font-semibold text-[#0F172A] break-words">
                                  {ktmInfo.studentName || '-'}
                                </span>
                              </div>
                            </div>
                            {ktmInfo.studyProgram && (
                              <div>
                                <span className="text-[10px] text-[#64748B] block">
                                  {lang === 'id' ? 'Prodi / Jurusan' : 'Program'}
                                </span>
                                <span className="font-medium text-[#334155]">
                                  {ktmInfo.studyProgram}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {infoMsg && (
              <div className="p-2.5 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-[11px] font-medium text-[#065F46]">
                {infoMsg}
              </div>
            )}

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[11px] font-medium text-[#B91C1C] space-y-2">
                <p>{errorMsg}</p>
                {suggestGmailActions && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={openGoogleModalWithCurrentEmail}
                      className="px-2.5 py-1.5 rounded-lg bg-[#059669] text-white text-[10px] font-bold cursor-pointer"
                    >
                      {t.googleBtn}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('reset');
                        setErrorMsg('');
                        setSuggestGmailActions(false);
                        setPassword('');
                        setConfirmPassword('');
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-white border border-[#CBD5E1] text-[#0F172A] text-[10px] font-bold cursor-pointer"
                    >
                      {lang === 'id' ? 'Buat Password Akun' : 'Set Account Password'}
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[46px] rounded-xl bg-gradient-to-r from-[#059669] to-[#10B981] hover:from-[#047857] hover:to-[#059669] text-white text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-60"
            >
              {mode === 'login'
                ? t.loginBtn
                : mode === 'register'
                ? t.registerBtn
                : lang === 'id'
                ? 'Simpan Password Baru'
                : 'Save New Password'}
            </button>
          </form>

          {/* Security transparency note regarding Gmail passwords */}
          <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-[#059669] mt-0.5 shrink-0" />
            <p className="text-[10px] text-[#475569] leading-snug">{t.gmailSecurityNote}</p>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="h-px flex-1 bg-[#E2E8F0]" />
            <span className="text-[11px] text-[#94A3B8]">{t.orDivider}</span>
            <div className="h-px flex-1 bg-[#E2E8F0]" />
          </div>

          <button
            type="button"
            onClick={openGoogleModalWithCurrentEmail}
            className="w-full min-h-[44px] px-3 rounded-xl bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-xs font-bold text-[#0F172A] flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span>{t.googleBtn}</span>
          </button>
        </div>
      </div>

      {/* In-Frame Bottom Sheet for Google Account Picker (Editable Name & Gmail) */}
      {showGoogleSheet && (
        <div
          className="absolute inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-end"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleGoogleSubmit}
            className="w-full bg-white rounded-t-3xl p-5 space-y-3.5 shadow-2xl"
          >
            <div className="w-10 h-1 bg-[#CBD5E1] rounded-full mx-auto mb-1" />
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-display text-sm font-bold text-[#0F172A]">
                  {t.googleModalTitle}
                </h2>
                <p className="text-[11px] text-[#64748B]">{t.googleModalSubtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowGoogleSheet(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#64748B] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                  {lang === 'id' ? 'Nama Akun Google' : 'Google Account Name'}
                </label>
                <input
                  type="text"
                  required
                  value={googleName}
                  onChange={(e) => {
                    setGoogleName(e.target.value);
                    setGoogleNameEdited(true);
                  }}
                  placeholder={lang === 'id' ? 'Contoh: Budi Santoso' : 'e.g. Budi Santoso'}
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#10B981]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                  {lang === 'id' ? 'Alamat Gmail' : 'Gmail Address'}
                </label>
                <input
                  type="email"
                  required
                  value={googleEmail}
                  onChange={(e) => handleGoogleEmailChange(e.target.value)}
                  placeholder="nama@gmail.com"
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] focus:outline-none focus:border-[#10B981]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                  {t.categoryLabel}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGoogleRole('student')}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer ${
                      googleRole === 'student'
                        ? 'bg-[#ECFDF5] border-[#10B981] text-[#059669]'
                        : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#0F172A]'
                    }`}
                  >
                    <p className="text-[11px] font-bold flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                      <span>{lang === 'id' ? 'Mahasiswa' : 'Student'}</span>
                    </p>
                    <p className="text-[10px] text-[#047857] mt-0.5 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 shrink-0" />
                      <span>Rp 7.000/jemput</span>
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGoogleRole('household')}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer ${
                      googleRole === 'household'
                        ? 'bg-[#ECFDF5] border-[#10B981] text-[#059669]'
                        : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#0F172A]'
                    }`}
                  >
                    <p className="text-[11px] font-bold flex items-center gap-1">
                      <Home className="w-3.5 h-3.5 shrink-0" />
                      <span>{t.roleHousehold}</span>
                    </p>
                    <p className="text-[10px] text-[#64748B] mt-0.5">Rp 10.000/jemput</p>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowGoogleSheet(false)}
                className="flex-1 min-h-[42px] rounded-xl border border-[#E2E8F0] text-xs font-semibold text-[#64748B] cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                className="flex-[2] min-h-[42px] px-3 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold truncate cursor-pointer"
              >
                {lang === 'id' ? 'Masuk sebagai' : 'Continue as'}{' '}
                {googleName.trim() || deriveNameFromEmail(googleEmail)}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* In-Frame Camera KTM Scanner */}
      {showKtmScanner && (
        <KtmScannerModal
          lang={lang}
          studentName={fullName || deriveNameFromEmail(email)}
          onClose={() => setShowKtmScanner(false)}
          onCaptured={(res) => {
            setErrorMsg('');
            setKtmFileName(res.fileName);
            setKtmPreviewUrl(res.previewUrl);
            setKtmInfo(res.ktmInfo);
            setCopiedKtmSummary(true);
            setTimeout(() => setCopiedKtmSummary(false), 2500);
            if (!fullName.trim() && res.ktmInfo.studentName) {
              setFullName(res.ktmInfo.studentName);
            }
            setShowKtmScanner(false);
          }}
        />
      )}
    </div>
  );
}
