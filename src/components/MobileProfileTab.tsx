import { useState } from 'react';
import {
  Award,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  GraduationCap,
  Home,
  KeyRound,
  Leaf,
  Lock,
  LogOut,
  PauseCircle,
  Pencil,
  PlayCircle,
  ScanLine,
  Share2,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { KtmExtractedInfo, Language, UserProfile } from '../types/ecomove';
import { getT } from '../i18n/translations';
import {
  evaluatePasswordCriteria,
  getStoredAccount,
  hashPassword,
  saveStoredAccountRecord,
  verifyPassword,
} from '../utils/authSecurity';
import { LanguageToggle } from './LanguageToggle';
import { KtmScannerModal } from './KtmScannerModal';
import { PasswordCriteriaChecklist } from './PasswordCriteriaChecklist';

interface MobileProfileTabProps {
  lang: Language;
  user: UserProfile;
  onChangeLang: (lang: Language) => void;
  onUpdateName: (name: string) => void;
  onKtmScanned: (
    previewUrl: string,
    fileName: string,
    ktmInfo?: KtmExtractedInfo
  ) => void;
  onTogglePauseSubscription: (paused: boolean, startDate: string, endDate: string) => void;
  onRedeemPoints: (pointsCost: number, discountAmount: number) => boolean;
  onToggleRoleDemo: () => void;
  onLogout: () => void;
}

function daysBetween(start: string, end: string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 0;
  return Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1);
}

function addDaysToDate(dateStr: string, daysToAdd: number): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() + daysToAdd);
  return d.toISOString().slice(0, 10);
}

export function MobileProfileTab({
  lang,
  user,
  onChangeLang,
  onUpdateName,
  onKtmScanned,
  onTogglePauseSubscription,
  onRedeemPoints,
  onToggleRoleDemo,
  onLogout,
}: MobileProfileTabProps) {
  const t = getT(lang);
  const [redeemSuccessMsg, setRedeemSuccessMsg] = useState('');
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showKtmScanner, setShowKtmScanner] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [copiedKtmData, setCopiedKtmData] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(user.name);

  // Password management state
  const [showPasswordPanel, setShowPasswordPanel] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmNewPwd, setConfirmNewPwd] = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');

  const storedAccount = getStoredAccount(user.email);
  const hasExistingPassword = Boolean(
    storedAccount?.passwordHash && storedAccount?.passwordSalt
  );

  const pauseDays = user.subscription.paused
    ? daysBetween(user.subscription.pauseStartDate, user.subscription.pauseEndDate)
    : 0;
  const effectiveEndDate = addDaysToDate(user.subscription.endDate, pauseDays);

  const { impact } = user;
  const maxBarKg = Math.max(...impact.monthlyHistory.map((m) => m.kg), 1);
  const organicPct = Math.round(
    (impact.organicKg / Math.max(impact.totalKgThisMonth, 1)) * 100
  );

  const shareText =
    lang === 'id'
      ? `Bulan ini saya berhasil mengelola ${impact.totalKgThisMonth.toFixed(
          1
        )} kg sampah terpilah lewat EcoMove dan mengurangi ${impact.co2ReducedKg.toFixed(
          1
        )} kg CO2e! Yuk pilah sampah bareng EcoMove. #EcoMove`
      : `This month I diverted ${impact.totalKgThisMonth.toFixed(
          1
        )} kg of sorted waste via EcoMove and reduced ${impact.co2ReducedKg.toFixed(
          1
        )} kg CO2e! #EcoMove`;

  const handleRedeem = (cost: number, discount: number) => {
    const ok = onRedeemPoints(cost, discount);
    if (ok) {
      setRedeemSuccessMsg(t.redeemSuccess);
      setTimeout(() => setRedeemSuccessMsg(''), 3000);
    }
  };

  const handleShareClick = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'EcoMove Eco-Impact',
          text: shareText,
        });
        return;
      } catch {
        // fallback to in-frame modal
      }
    }
    setShowShareSheet(true);
  };

  const handleCopyCaption = () => {
    navigator.clipboard?.writeText(shareText).catch(() => {});
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2000);
  };

  const handleCopyKtmInfo = () => {
    if (!user.ktmInfo?.copiedSummary) return;
    navigator.clipboard?.writeText(user.ktmInfo.copiedSummary).catch(() => {});
    setCopiedKtmData(true);
    setTimeout(() => setCopiedKtmData(false), 2200);
  };

  const handleSaveName = () => {
    const clean = draftName.trim();
    if (clean) {
      onUpdateName(clean);
    }
    setEditingName(false);
  };

  const handleSaveNewPassword = async () => {
    setPwdError('');
    setPwdSuccess('');

    if (hasExistingPassword && storedAccount?.passwordSalt && storedAccount?.passwordHash) {
      if (!currentPwd) {
        setPwdError(
          lang === 'id'
            ? 'Masukkan password saat ini terlebih dahulu.'
            : 'Please enter your current password first.'
        );
        return;
      }
      const validCurrent = await verifyPassword(
        currentPwd,
        storedAccount.passwordSalt,
        storedAccount.passwordHash
      );
      if (!validCurrent) {
        setPwdError(t.wrongPasswordError);
        return;
      }
    }

    const criteria = evaluatePasswordCriteria(newPwd, user.email);
    if (!criteria.isValid) {
      setPwdError(t.passwordCriteriaError);
      return;
    }
    if (newPwd !== confirmNewPwd) {
      setPwdError(t.passwordMismatchError);
      return;
    }

    const { salt, hash } = await hashPassword(newPwd);
    saveStoredAccountRecord({
      profile: user,
      passwordSalt: salt,
      passwordHash: hash,
      updatedAt: Date.now(),
    });

    setCurrentPwd('');
    setNewPwd('');
    setConfirmNewPwd('');
    setPwdSuccess(
      lang === 'id'
        ? 'Password akun berhasil diperbarui dengan aman!'
        : 'Account password updated securely!'
    );
    setTimeout(() => {
      setPwdSuccess('');
      setShowPasswordPanel(false);
    }, 2200);
  };

  return (
    <div className="p-4 space-y-4 pb-6 relative">
      <h2 className="font-display text-base font-bold text-[#0F172A]">
        {t.profileTitle}
      </h2>

      {/* User Info & KTM Verification */}
      <section className="bg-white rounded-2xl border border-[#E2E8F0] p-4 space-y-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#059669] text-white flex items-center justify-center font-display font-bold text-base shrink-0">
            {user.name.trim().charAt(0).toUpperCase() || 'E'}
          </div>
          <div className="min-w-0 flex-1">
            {editingName ? (
              <div className="flex items-center gap-1.5 mb-1">
                <input
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="flex-1 min-w-0 px-2 py-1 rounded-lg border border-[#10B981] text-xs font-bold text-[#0F172A] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSaveName}
                  className="px-2 py-1 rounded-lg bg-[#059669] text-white text-[11px] font-bold cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-bold text-[#0F172A] truncate">{user.name}</p>
                <button
                  type="button"
                  onClick={() => {
                    setDraftName(user.name);
                    setEditingName(true);
                  }}
                  aria-label="Edit name"
                  className="p-1 rounded-md text-[#64748B] hover:text-[#059669] cursor-pointer shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <p className="text-[11px] text-[#64748B] truncate">{user.email}</p>
            <p className="text-[11px] font-bold text-[#059669] flex items-center gap-1 mt-0.5">
              {user.role === 'student' ? (
                <>
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>
                    {user.ktmVerified
                      ? user.ktmInfo?.cardType === 'Kartu Pelajar'
                        ? lang === 'id'
                          ? 'Kartu Pelajar Terverifikasi'
                          : 'Student ID Verified'
                        : t.ktmUploadedBadge
                      : lang === 'id'
                      ? 'Belum Scan KTM / Kartu Pelajar'
                      : 'Student ID Not Scanned Yet'}
                  </span>
                </>
              ) : (
                <>
                  <Home className="w-3.5 h-3.5 text-[#475569]" />
                  <span className="text-[#475569]">{t.roleHousehold}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {user.role === 'student' && user.ktmPreviewUrl && (
          <div className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] p-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold text-[#059669] flex items-center gap-1 min-w-0">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  {user.ktmInfo?.cardType || 'KTM'} Verified · {user.ktmFileName || 'KTM_2026'}
                </span>
              </p>
              {user.ktmInfo?.copiedSummary && (
                <button
                  type="button"
                  onClick={handleCopyKtmInfo}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-[#A7F3D0] text-[#059669] text-[10px] font-bold cursor-pointer shrink-0"
                >
                  {copiedKtmData ? (
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
              )}
            </div>
            <img
              src={user.ktmPreviewUrl}
              alt="KTM Preview"
              referrerPolicy="no-referrer"
              className="w-full h-24 object-contain rounded-lg bg-white"
            />
            {user.ktmInfo && (
              <div className="rounded-lg bg-white border border-[#D1FAE5] p-2 text-[11px] space-y-1">
                <div>
                  <span className="text-[10px] text-[#64748B] block">
                    {lang === 'id' ? 'Kampus / Sekolah' : 'Institution'}
                  </span>
                  <span className="font-bold text-[#0F172A] break-words">
                    {user.ktmInfo.campusName || '-'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-[#64748B] block">NIM / NISN</span>
                    <span className="font-mono-tabular font-bold text-[#059669] break-all">
                      {user.ktmInfo.nim || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#64748B] block">
                      {lang === 'id' ? 'Nama' : 'Name'}
                    </span>
                    <span className="font-semibold text-[#0F172A] break-words">
                      {user.ktmInfo.studentName || user.name}
                    </span>
                  </div>
                </div>
                {user.ktmInfo.studyProgram && (
                  <div>
                    <span className="text-[10px] text-[#64748B] block">
                      {lang === 'id' ? 'Prodi / Jurusan' : 'Program'}
                    </span>
                    <span className="font-medium text-[#334155]">
                      {user.ktmInfo.studyProgram}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowKtmScanner(true)}
          className="w-full min-h-[40px] rounded-xl bg-[#ECFDF5] hover:bg-[#D1FAE5] border border-[#A7F3D0] text-[#059669] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <ScanLine className="w-4 h-4" />
          <span>
            {user.role === 'student'
              ? lang === 'id'
                ? 'Scan Ulang / Perbarui KTM'
                : 'Rescan / Update Student ID'
              : lang === 'id'
              ? 'Scan KTM untuk Aktifkan Diskon Mahasiswa'
              : 'Scan Student ID for Discount'}
          </span>
        </button>
      </section>

      {/* Monthly Subscription & Cuti Jemput / Pause */}
      <section className="bg-white rounded-2xl border border-[#E2E8F0] p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-xs font-bold text-[#0F172A]">
            {t.subCardTitle}
          </h3>
          <span
            className={`text-[11px] font-bold ${
              user.subscription.paused ? 'text-[#D97706]' : 'text-[#059669]'
            }`}
          >
            {user.subscription.paused ? t.subPausedStatus : t.subActiveStatus}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
          <div>
            <p className="text-[10px] text-[#64748B]">{t.subRemaining}</p>
            <p className="font-mono-tabular text-sm font-bold text-[#0F172A]">
              {user.subscription.remainingPickups}x
            </p>
          </div>
          <div>
            <p className="text-[10px] text-[#64748B]">{t.subValidUntil}</p>
            <p className="font-mono-tabular text-xs font-bold text-[#059669]">
              {effectiveEndDate}
            </p>
          </div>
        </div>

        {/* Pause Toggle */}
        <div className="p-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {user.subscription.paused ? (
                <PauseCircle className="w-4 h-4 text-[#D97706] shrink-0" />
              ) : (
                <PlayCircle className="w-4 h-4 text-[#059669] shrink-0" />
              )}
              <span className="text-xs font-bold text-[#0F172A] truncate">
                {t.pauseToggleLabel}
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={user.subscription.paused}
              onClick={() =>
                onTogglePauseSubscription(
                  !user.subscription.paused,
                  user.subscription.pauseStartDate,
                  user.subscription.pauseEndDate
                )
              }
              className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${
                user.subscription.paused ? 'bg-[#D97706]' : 'bg-[#CBD5E1]'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                  user.subscription.paused ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <p className="text-[11px] text-[#64748B] leading-snug">{t.pauseDesc}</p>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-[#64748B] mb-1">
                {t.pauseStartLabel}
              </label>
              <input
                type="date"
                value={user.subscription.pauseStartDate}
                onChange={(e) =>
                  onTogglePauseSubscription(
                    true,
                    e.target.value,
                    user.subscription.pauseEndDate
                  )
                }
                className="w-full min-h-[36px] px-2 py-1 rounded-lg bg-white border border-[#E2E8F0] text-[11px] font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[#64748B] mb-1">
                {t.pauseEndLabel}
              </label>
              <input
                type="date"
                value={user.subscription.pauseEndDate}
                onChange={(e) =>
                  onTogglePauseSubscription(
                    true,
                    user.subscription.pauseStartDate,
                    e.target.value
                  )
                }
                className="w-full min-h-[36px] px-2 py-1 rounded-lg bg-white border border-[#E2E8F0] text-[11px] font-mono-tabular"
              />
            </div>
          </div>

          {user.subscription.paused && pauseDays > 0 && (
            <p className="text-[11px] font-bold text-[#059669] flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>
                {t.subExtendedNote}: +{pauseDays} {t.daysUnit}
              </span>
            </p>
          )}
        </div>
      </section>

      {/* EcoPoints Redemption */}
      <section className="bg-white rounded-2xl border border-[#E2E8F0] p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
            <Award className="w-4 h-4 text-[#059669]" />
            <span>{t.redeemTitle}</span>
          </h3>
          <span className="font-mono-tabular text-xs font-bold text-[#059669]">
            {user.ecoPoints} pts
          </span>
        </div>

        {redeemSuccessMsg && (
          <p className="p-2 rounded-xl bg-[#ECFDF5] text-[11px] font-bold text-[#059669]">
            {redeemSuccessMsg}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            disabled={user.ecoPoints < 100}
            onClick={() => handleRedeem(100, 5000)}
            className="p-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#10B981] text-left disabled:opacity-50 cursor-pointer"
          >
            <p className="text-xs font-bold text-[#0F172A]">{t.redeemOption1}</p>
            <p className="font-mono-tabular text-[11px] text-[#059669] font-semibold mt-0.5">
              {t.redeemOption1Cost} · {t.redeemNow}
            </p>
          </button>

          <button
            type="button"
            disabled={user.ecoPoints < 250}
            onClick={() => handleRedeem(250, 15000)}
            className="p-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#10B981] text-left disabled:opacity-50 cursor-pointer"
          >
            <p className="text-xs font-bold text-[#0F172A]">{t.redeemOption2}</p>
            <p className="font-mono-tabular text-[11px] text-[#059669] font-semibold mt-0.5">
              {t.redeemOption2Cost} · {t.redeemNow}
            </p>
          </button>
        </div>
      </section>

      {/* Eco-Impact Tracker Card */}
      <section className="bg-white rounded-2xl border border-[#E2E8F0] p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
              <Leaf className="w-4 h-4 text-[#059669]" />
              <span>{t.impactTitle}</span>
            </h3>
            <p className="text-[11px] text-[#64748B]">{t.impactSubtitle}</p>
          </div>
          <button
            type="button"
            onClick={handleShareClick}
            className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[34px] rounded-xl bg-[#059669] text-white text-[11px] font-bold cursor-pointer shrink-0"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{lang === 'id' ? 'Bagikan' : 'Share'}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0]">
            <p className="text-[10px] text-[#047857]">{t.totalManagedMonth}</p>
            <p className="font-mono-tabular text-lg font-bold text-[#059669]">
              {impact.totalKgThisMonth.toFixed(1)} kg
            </p>
          </div>
          <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <p className="text-[10px] text-[#64748B]">{t.co2Reduced}</p>
            <p className="font-mono-tabular text-lg font-bold text-[#0F172A]">
              {impact.co2ReducedKg.toFixed(1)} kg
            </p>
          </div>
        </div>

        <div className="space-y-1">
          <div className="h-2 w-full rounded-full bg-[#E2E8F0] overflow-hidden flex">
            <div className="bg-[#10B981] h-full" style={{ width: `${organicPct}%` }} />
            <div className="bg-[#059669] h-full" style={{ width: `${100 - organicPct}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-[#64748B]">
            <span>
              {t.organicLabel}: <strong className="font-mono-tabular">{impact.organicKg} kg</strong>
            </span>
            <span>
              {t.inorganicLabel}:{' '}
              <strong className="font-mono-tabular">{impact.inorganicKg} kg</strong>
            </span>
          </div>
        </div>

        {/* Compact 6-Month Bar Chart */}
        <div className="pt-1">
          <p className="text-[11px] font-semibold text-[#475569] mb-2">
            {t.monthlyChartTitle}
          </p>
          <div className="h-28 flex items-end justify-between gap-2 pt-3 border-b border-[#F1F5F9] pb-1.5">
            {impact.monthlyHistory.map((item, idx) => {
              const heightPct = Math.max(18, Math.round((item.kg / maxBarKg) * 100));
              const isLatest = idx === impact.monthlyHistory.length - 1;
              return (
                <div
                  key={item.month}
                  className="flex-1 flex flex-col items-center gap-1 h-full justify-end"
                >
                  <span className="font-mono-tabular text-[10px] font-bold text-[#0F172A]">
                    {item.kg.toFixed(0)}
                  </span>
                  <div
                    className={`w-full rounded-t-lg ${
                      isLatest ? 'bg-[#059669]' : 'bg-[#A7F3D0]'
                    }`}
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className="text-[10px] text-[#64748B]">{item.month}</span>
                </div>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={handleShareClick}
          className="w-full min-h-[40px] rounded-xl bg-[#ECFDF5] hover:bg-[#D1FAE5] text-[#059669] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>{t.shareImpactBtn}</span>
        </button>
      </section>

      {/* Account Security & Password Criteria */}
      <section className="bg-white rounded-2xl border border-[#E2E8F0] p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <KeyRound className="w-4 h-4 text-[#059669] shrink-0" />
            <div className="min-w-0">
              <h3 className="font-display text-xs font-bold text-[#0F172A] truncate">
                {lang === 'id' ? 'Keamanan & Password Akun' : 'Account Password Security'}
              </h3>
              <p className="text-[10px] text-[#64748B] truncate">
                {hasExistingPassword
                  ? lang === 'id'
                    ? 'Password aktif · terenkripsi PBKDF2'
                    : 'Password active · PBKDF2 protected'
                  : lang === 'id'
                  ? 'Login via Google · belum atur password khusus'
                  : 'Google Sign-In · no app password set'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowPasswordPanel((prev) => !prev);
              setPwdError('');
              setPwdSuccess('');
            }}
            className="px-2.5 py-1.5 rounded-xl bg-[#ECFDF5] text-[#059669] text-[11px] font-bold cursor-pointer shrink-0 whitespace-nowrap"
          >
            {showPasswordPanel
              ? lang === 'id'
                ? 'Tutup'
                : 'Close'
              : hasExistingPassword
              ? lang === 'id'
                ? 'Ubah'
                : 'Change'
              : lang === 'id'
              ? 'Atur'
              : 'Set'}
          </button>
        </div>

        {showPasswordPanel && (
          <div className="space-y-2.5 pt-2 border-t border-[#F1F5F9]">
            {hasExistingPassword && (
              <div>
                <label className="block text-[10px] font-semibold text-[#475569] mb-1">
                  {lang === 'id' ? 'Password Saat Ini' : 'Current Password'}
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={currentPwd}
                    onChange={(e) => setCurrentPwd(e.target.value)}
                    placeholder="••••••••"
                    className="w-full min-h-[38px] pl-8 pr-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] focus:outline-none focus:border-[#10B981]"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-semibold text-[#475569] mb-1">
                {lang === 'id' ? 'Password Baru' : 'New Password'}
              </label>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showNewPwd ? 'text' : 'password'}
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder={lang === 'id' ? 'Min. 8 karakter kuat' : 'Min. 8 strong chars'}
                  className="w-full min-h-[38px] pl-8 pr-9 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] focus:outline-none focus:border-[#10B981]"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPwd((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B] cursor-pointer"
                >
                  {showNewPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <PasswordCriteriaChecklist lang={lang} password={newPwd} email={user.email} />

            <div>
              <label className="block text-[10px] font-semibold text-[#475569] mb-1">
                {t.confirmPasswordLabel}
              </label>
              <input
                type={showNewPwd ? 'text' : 'password'}
                value={confirmNewPwd}
                onChange={(e) => setConfirmNewPwd(e.target.value)}
                placeholder={lang === 'id' ? 'Ulangi password baru' : 'Re-enter new password'}
                className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] focus:outline-none focus:border-[#10B981]"
              />
            </div>

            {pwdError && (
              <p className="p-2 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[11px] font-medium text-[#B91C1C]">
                {pwdError}
              </p>
            )}
            {pwdSuccess && (
              <p className="p-2 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-[11px] font-bold text-[#059669]">
                {pwdSuccess}
              </p>
            )}

            <button
              type="button"
              onClick={handleSaveNewPassword}
              className="w-full min-h-[40px] rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold cursor-pointer"
            >
              {lang === 'id' ? 'Simpan Password Akun' : 'Save Account Password'}
            </button>
          </div>
        )}
      </section>

      {/* Settings & Logout */}
      <section className="bg-white rounded-2xl border border-[#E2E8F0] p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#0F172A]">
            {t.languageSettingLabel}
          </span>
          <LanguageToggle lang={lang} onChange={onChangeLang} />
        </div>

        <button
          type="button"
          onClick={onToggleRoleDemo}
          className="w-full min-h-[40px] rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-xs font-bold text-[#0F172A] cursor-pointer"
        >
          {t.switchRoleDemo} ({user.role === 'student' ? t.roleHousehold : t.roleStudent})
        </button>

        <button
          type="button"
          onClick={onLogout}
          className="w-full min-h-[42px] rounded-xl border border-[#FECACA] bg-[#FEF2F2] text-xs font-bold text-[#B91C1C] flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>{t.logout}</span>
        </button>
      </section>

      {/* In-Frame Share Bottom Sheet */}
      {showShareSheet && (
        <div
          className="fixed sm:absolute inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-end"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full bg-white rounded-t-3xl p-5 space-y-3.5 shadow-2xl">
            <div className="w-10 h-1 bg-[#CBD5E1] rounded-full mx-auto" />
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-display text-sm font-bold text-[#0F172A]">
                  {t.shareModalTitle}
                </h3>
                <p className="text-[11px] text-[#64748B]">{t.shareModalDesc}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowShareSheet(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#64748B] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[#059669] text-white space-y-1.5">
              <p className="text-[10px] font-bold text-[#D1FAE5]">EcoMove · Eco-Impact</p>
              <p className="font-mono-tabular text-xl font-bold">
                {impact.totalKgThisMonth.toFixed(1)} kg
              </p>
              <p className="text-[11px] text-[#ECFDF5]">
                {user.name} · -{impact.co2ReducedKg.toFixed(1)} kg CO₂e
              </p>
            </div>

            <textarea
              readOnly
              rows={3}
              value={shareText}
              className="w-full p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[11px] text-[#0F172A] resize-none"
            />

            <button
              type="button"
              onClick={handleCopyCaption}
              className="w-full min-h-[42px] rounded-xl bg-[#059669] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {copiedCaption ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedCaption ? t.captionCopied : t.copyCaptionBtn}</span>
            </button>
          </div>
        </div>
      )}
      {/* In-Frame Camera KTM Scanner */}
      {showKtmScanner && (
        <KtmScannerModal
          lang={lang}
          studentName={user.name}
          onClose={() => setShowKtmScanner(false)}
          onCaptured={(res) => {
            onKtmScanned(res.previewUrl, res.fileName, res.ktmInfo);
            setCopiedKtmData(true);
            setTimeout(() => setCopiedKtmData(false), 2500);
            setShowKtmScanner(false);
          }}
        />
      )}
    </div>
  );
}
