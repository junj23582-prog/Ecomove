import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Banknote,
  Building2,
  Calendar,
  Check,
  Clock,
  Copy,
  QrCode,
  Recycle,
  ShieldCheck,
  Ticket,
  Truck,
  Zap,
} from 'lucide-react';
import {
  computeSyncedPickupEta,
  formatClockHHMM,
  formatClockWIB,
  getTodayLocalDateStr,
} from '../utils/trackingSimulation';
import type {
  Language,
  LocationSelection,
  PaymentMethod,
  ServiceType,
  UserProfile,
  VABank,
} from '../types/ecomove';
import { formatRupiah, getT } from '../i18n/translations';
import { formatLocationDetail } from '../data/mockData';
import { InteractiveMap } from './InteractiveMap';

export interface OrderDraft {
  serviceType: ServiceType;
  isExpress: boolean;
  isSorted: boolean;
  scheduleDays: string[];
  scheduleStartDate: string;
  scheduleTime: string;
  location: LocationSelection;
}

interface MobileOrderTabProps {
  lang: Language;
  user: UserProfile;
  draft: OrderDraft;
  step: 'form' | 'checkout';
  onChangeStep: (step: 'form' | 'checkout') => void;
  onChangeDraft: (next: OrderDraft) => void;
  onConfirmOrder: (params: {
    paymentMethod: PaymentMethod;
    vaBank?: VABank;
    vaNumber?: string;
    voucherId?: string;
    voucherDiscount: number;
    totalPrice: number;
    basePrice: number;
    studentDiscount: number;
    expressFee: number;
    earnedPoints: number;
  }) => void;
}

const CANONICAL_DAYS = [
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
  'Minggu',
];

const VA_PREFIXES: Record<VABank, string> = {
  BCA: '39012',
  Mandiri: '88014',
  BNI: '98807',
};

const QUICK_PICKUP_TIMES = [
  '07:00 WIB',
  '09:00 WIB',
  '11:00 WIB',
  '13:00 WIB',
  '16:00 WIB',
  '19:00 WIB',
  '20:00 WIB',
];

function extractTimeHHMM(scheduleTime: string): string {
  const match = scheduleTime.match(/(\d{2}:\d{2})/);
  return match ? match[1] : '09:00';
}

function DynamicQrisSvg({ seedText }: { seedText: string }) {
  const size = 21;
  const cells: boolean[][] = [];
  let hash = 0;
  for (let i = 0; i < seedText.length; i++) {
    hash = (hash * 31 + seedText.charCodeAt(i)) >>> 0;
  }

  for (let r = 0; r < size; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < size; c++) {
      const inTopLeft = r < 7 && c < 7;
      const inTopRight = r < 7 && c >= size - 7;
      const inBottomLeft = r >= size - 7 && c < 7;
      if (inTopLeft || inTopRight || inBottomLeft) {
        const lr = r < 7 ? r : r - (size - 7);
        const lc = c < 7 ? c : c - (size - 7);
        const border = lr === 0 || lr === 6 || lc === 0 || lc === 6;
        const inner = lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4;
        row.push(border || inner);
      } else {
        hash = (hash * 1664525 + 1013904223) >>> 0;
        row.push(((hash >> 16) & 1) === 1);
      }
    }
    cells.push(row);
  }

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="w-36 h-36 mx-auto bg-white p-2 rounded-xl border border-[#E2E8F0]"
      role="img"
      aria-label="QRIS Code"
    >
      {cells.map((row, r) =>
        row.map((filled, c) =>
          filled ? (
            <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="#0F172A" />
          ) : null
        )
      )}
    </svg>
  );
}

export function MobileOrderTab({
  lang,
  user,
  draft,
  step,
  onChangeStep,
  onChangeDraft,
  onConfirmOrder,
}: MobileOrderTabProps) {
  const t = getT(lang);
  const isStudent = user.role === 'student';
  const unusedVouchers = user.vouchers.filter((v) => !v.used);

  const [selectedVoucherId, setSelectedVoucherId] = useState<string>(
    unusedVouchers[0]?.id ?? ''
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('qris');
  const [vaBank, setVaBank] = useState<VABank>('BCA');
  const [copiedVa, setCopiedVa] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const selectedVoucher = unusedVouchers.find((v) => v.id === selectedVoucherId);

  const syncedEta = useMemo(
    () =>
      computeSyncedPickupEta({
        location: draft.location,
        isExpress: draft.serviceType === 'express' || draft.isExpress,
        scheduleStartDate: draft.scheduleStartDate,
        scheduleTime: draft.scheduleTime,
        nowMs,
      }),
    [
      draft.location,
      draft.serviceType,
      draft.isExpress,
      draft.scheduleStartDate,
      draft.scheduleTime,
      nowMs,
    ]
  );

  const pricing = useMemo(() => {
    const isMonthly = draft.serviceType === 'monthly';
    const basePrice = isMonthly ? 150000 : 10000;
    const studentDiscount = isStudent ? (isMonthly ? 50000 : 3000) : 0;
    const expressFee = draft.serviceType === 'express' || draft.isExpress ? 5000 : 0;
    const subtotal = basePrice - studentDiscount + expressFee;
    const voucherDiscount = selectedVoucher
      ? Math.min(selectedVoucher.discountAmount, subtotal)
      : 0;
    const totalPrice = Math.max(0, subtotal - voucherDiscount);
    const earnedPoints = draft.isSorted ? 35 : 10;

    return {
      basePrice,
      studentDiscount,
      expressFee,
      subtotal,
      voucherDiscount,
      totalPrice,
      earnedPoints,
    };
  }, [draft, isStudent, selectedVoucher]);

  const vaNumber = `${VA_PREFIXES[vaBank]}08128490221`;

  const handleCopyVa = () => {
    navigator.clipboard?.writeText(vaNumber).catch(() => {});
    setCopiedVa(true);
    setTimeout(() => setCopiedVa(false), 2000);
  };

  const handleToggleDay = (day: string) => {
    const exists = draft.scheduleDays.includes(day);
    const nextDays = exists
      ? draft.scheduleDays.filter((d) => d !== day)
      : [...draft.scheduleDays, day];
    onChangeDraft({
      ...draft,
      scheduleDays: nextDays.length > 0 ? nextDays : [day],
    });
  };

  if (step === 'checkout') {
    return (
      <div className="p-4 space-y-4 pb-6">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onChangeStep('form')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-xl bg-white border border-[#E2E8F0] text-xs font-bold text-[#0F172A] cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t.backToOrder}</span>
          </button>
          <h2 className="font-display text-sm font-bold text-[#0F172A]">
            {t.checkoutTitle}
          </h2>
        </div>

        {/* Breakdown Card */}
        <section className="bg-white rounded-2xl border border-[#E2E8F0] p-4 space-y-3 shadow-xs">
          <div className="pb-2.5 border-b border-[#F1F5F9]">
            <p className="text-xs font-bold text-[#059669]">
              {draft.serviceType === 'monthly'
                ? t.serviceMonthlyTitle
                : draft.serviceType === 'express'
                ? t.serviceExpressTitle
                : t.serviceOnDemandTitle}
            </p>
            <p className="text-[11px] text-[#64748B] truncate mt-0.5">
              {draft.location.address}
            </p>
            {formatLocationDetail(draft.location) && (
              <p className="text-[11px] font-semibold text-[#059669] truncate mt-0.5">
                {formatLocationDetail(draft.location)}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#ECFDF5] border border-[#A7F3D0] text-[11px] font-semibold text-[#065F46]">
                <Clock className="w-3 h-3 text-[#059669] shrink-0" />
                <span>
                  {t.pickupScheduleSelectedLabel}: {draft.scheduleStartDate} ·{' '}
                  {syncedEta.isAdjustedToFastest
                    ? formatClockWIB(syncedEta.etaTargetTimestamp)
                    : draft.scheduleTime}
                </span>
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#F8FAFC] border border-[#CBD5E1] text-[10px] font-mono-tabular font-bold text-[#0F172A]">
                {t.etaLabel}: {formatClockWIB(syncedEta.etaTargetTimestamp)}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-[#475569] flex items-center gap-1">
              <Ticket className="w-3.5 h-3.5 text-[#059669]" />
              <span>{t.voucherSectionLabel}</span>
            </label>
            <select
              value={selectedVoucherId}
              onChange={(e) => setSelectedVoucherId(e.target.value)}
              className="w-full min-h-[40px] px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A]"
            >
              <option value="">{t.noVoucherLabel}</option>
              {unusedVouchers.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.code} — {lang === 'id' ? v.labelId : v.labelEn}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 text-xs pt-2 border-t border-[#F1F5F9]">
            <div className="flex justify-between text-[#475569]">
              <span>{t.basePriceLabel}</span>
              <span className="font-mono-tabular">{formatRupiah(pricing.basePrice)}</span>
            </div>
            {pricing.studentDiscount > 0 && (
              <div className="flex justify-between text-[#059669]">
                <span>{t.studentDiscountLabel}</span>
                <span className="font-mono-tabular font-bold">
                  -{formatRupiah(pricing.studentDiscount)}
                </span>
              </div>
            )}
            {pricing.expressFee > 0 && (
              <div className="flex justify-between text-[#D97706]">
                <span>{t.expressFeeLabel}</span>
                <span className="font-mono-tabular font-bold">
                  +{formatRupiah(pricing.expressFee)}
                </span>
              </div>
            )}
            {pricing.voucherDiscount > 0 && (
              <div className="flex justify-between text-[#059669]">
                <span>Voucher</span>
                <span className="font-mono-tabular font-bold">
                  -{formatRupiah(pricing.voucherDiscount)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-[11px] text-[#059669]">
              <span>{t.pointsEarnedLabel}</span>
              <span className="font-mono-tabular font-bold">+{pricing.earnedPoints} pts</span>
            </div>
            <div className="pt-2 border-t border-[#F1F5F9] flex items-center justify-between">
              <span className="font-display font-bold text-[#0F172A]">{t.totalPayLabel}</span>
              <span className="font-mono-tabular text-lg font-bold text-[#059669]">
                {formatRupiah(pricing.totalPrice)}
              </span>
            </div>
          </div>
        </section>

        {/* Payment Methods */}
        <section className="bg-white rounded-2xl border border-[#E2E8F0] p-4 space-y-2.5 shadow-xs">
          <h3 className="font-display text-xs font-bold text-[#0F172A]">
            {t.paymentMethodTitle}
          </h3>

          {/* QRIS */}
          <button
            type="button"
            onClick={() => setPaymentMethod('qris')}
            className={`w-full p-3 rounded-xl border text-left flex items-center justify-between cursor-pointer ${
              paymentMethod === 'qris'
                ? 'bg-[#ECFDF5] border-[#10B981]'
                : 'bg-[#F8FAFC] border-[#E2E8F0]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <QrCode className="w-4 h-4 text-[#059669]" />
              <span className="text-xs font-bold text-[#0F172A]">{t.payQRIS}</span>
            </div>
            <span className="text-[10px] font-bold text-[#059669]">Instant</span>
          </button>

          {paymentMethod === 'qris' && (
            <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-center space-y-2">
              <p className="text-[11px] text-[#64748B]">{t.qrisScanHint}</p>
              <DynamicQrisSvg seedText={`ECOMOVE-${pricing.totalPrice}`} />
              <p className="font-mono-tabular text-[10px] font-semibold text-[#475569]">
                NMID: ID1020039481920 · EcoMove
              </p>
            </div>
          )}

          {/* Virtual Account */}
          <button
            type="button"
            onClick={() => setPaymentMethod('va')}
            className={`w-full p-3 rounded-xl border text-left flex items-center justify-between cursor-pointer ${
              paymentMethod === 'va'
                ? 'bg-[#ECFDF5] border-[#10B981]'
                : 'bg-[#F8FAFC] border-[#E2E8F0]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Building2 className="w-4 h-4 text-[#059669]" />
              <span className="text-xs font-bold text-[#0F172A]">{t.payVA}</span>
            </div>
            <span className="text-[10px] text-[#64748B]">BCA/Mandiri/BNI</span>
          </button>

          {paymentMethod === 'va' && (
            <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2.5">
              <div className="grid grid-cols-3 gap-1.5">
                {(['BCA', 'Mandiri', 'BNI'] as VABank[]).map((bank) => (
                  <button
                    key={bank}
                    type="button"
                    onClick={() => setVaBank(bank)}
                    className={`py-1.5 min-h-[34px] rounded-lg text-[11px] font-bold border cursor-pointer ${
                      vaBank === bank
                        ? 'bg-[#059669] text-white border-[#059669]'
                        : 'bg-white text-[#0F172A] border-[#E2E8F0]'
                    }`}
                  >
                    {bank}
                  </button>
                ))}
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-[#E2E8F0] flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] text-[#64748B]">VA {vaBank}</p>
                  <p className="font-mono-tabular text-xs font-bold text-[#0F172A]">
                    {vaNumber}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyVa}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#ECFDF5] text-[#059669] text-[11px] font-bold cursor-pointer"
                >
                  {copiedVa ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedVa ? t.vaCopied : t.vaCopyBtn}</span>
                </button>
              </div>
            </div>
          )}

          {/* Cash */}
          <button
            type="button"
            onClick={() => setPaymentMethod('cash')}
            className={`w-full p-3 rounded-xl border text-left flex items-center justify-between cursor-pointer ${
              paymentMethod === 'cash'
                ? 'bg-[#ECFDF5] border-[#10B981]'
                : 'bg-[#F8FAFC] border-[#E2E8F0]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Banknote className="w-4 h-4 text-[#059669]" />
              <span className="text-xs font-bold text-[#0F172A]">{t.payCash}</span>
            </div>
            <span className="text-[10px] text-[#64748B]">COD</span>
          </button>

          {paymentMethod === 'cash' && (
            <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[11px] text-[#64748B]">
              {t.cashHint}
            </div>
          )}
        </section>

        <button
          type="button"
          onClick={() =>
            onConfirmOrder({
              paymentMethod,
              vaBank: paymentMethod === 'va' ? vaBank : undefined,
              vaNumber: paymentMethod === 'va' ? vaNumber : undefined,
              voucherId: selectedVoucher?.id,
              voucherDiscount: pricing.voucherDiscount,
              totalPrice: pricing.totalPrice,
              basePrice: pricing.basePrice,
              studentDiscount: pricing.studentDiscount,
              expressFee: pricing.expressFee,
              earnedPoints: pricing.earnedPoints,
            })
          }
          className="w-full min-h-[48px] rounded-2xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm cursor-pointer"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>
            {t.confirmPayBtn} · {formatRupiah(pricing.totalPrice)}
          </span>
        </button>
      </div>
    );
  }

  // Step 1: Map + Order Form
  return (
    <div className="p-4 space-y-4 pb-6">
      <h2 className="font-display text-base font-bold text-[#0F172A]">
        {t.orderTabTitle}
      </h2>

      {/* Interactive Grab/Gojek-Style Map */}
      <InteractiveMap
        lang={lang}
        value={draft.location}
        onChange={(loc) => onChangeDraft({ ...draft, location: loc })}
      />

      {/* Service Type Selector */}
      <section className="bg-white rounded-2xl border border-[#E2E8F0] p-3.5 space-y-2.5 shadow-xs">
        <p className="text-xs font-bold text-[#0F172A]">{t.chooseServiceTitle}</p>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() =>
              onChangeDraft({ ...draft, serviceType: 'ondemand', isExpress: false })
            }
            className={`p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
              draft.serviceType === 'ondemand'
                ? 'bg-[#ECFDF5] border-[#10B981] text-[#059669]'
                : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#0F172A]'
            }`}
          >
            <Truck className="w-4 h-4 mb-1" />
            <p className="text-[11px] font-bold leading-tight">{t.serviceOnDemandTag}</p>
            <p className="font-mono-tabular text-[11px] font-bold mt-1">
              {isStudent ? 'Rp 7rb' : 'Rp 10rb'}
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              onChangeDraft({ ...draft, serviceType: 'monthly', isExpress: false })
            }
            className={`p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
              draft.serviceType === 'monthly'
                ? 'bg-[#ECFDF5] border-[#10B981] text-[#059669]'
                : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#0F172A]'
            }`}
          >
            <Calendar className="w-4 h-4 mb-1" />
            <p className="text-[11px] font-bold leading-tight">{t.serviceMonthlyTag}</p>
            <p className="font-mono-tabular text-[11px] font-bold mt-1">
              {isStudent ? 'Rp 100rb' : 'Rp 150rb'}
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              const fastestExpress = computeSyncedPickupEta({
                location: draft.location,
                isExpress: true,
                nowMs: Date.now(),
              });
              onChangeDraft({
                ...draft,
                serviceType: 'express',
                isExpress: true,
                scheduleStartDate: getTodayLocalDateStr(),
                scheduleTime: formatClockWIB(fastestExpress.minArrivalTimestamp),
              });
            }}
            className={`p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
              draft.serviceType === 'express'
                ? 'bg-[#FFFBEB] border-[#D97706] text-[#B45309]'
                : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#0F172A]'
            }`}
          >
            <Zap className="w-4 h-4 mb-1" />
            <p className="text-[11px] font-bold leading-tight">Express</p>
            <p className="font-mono-tabular text-[11px] font-bold mt-1">
              {isStudent ? 'Rp 12rb' : 'Rp 15rb'}
            </p>
          </button>
        </div>
      </section>

      {/* Date & Time Schedule */}
      <section className="bg-white rounded-2xl border border-[#E2E8F0] p-3.5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold text-[#0F172A]">{t.scheduleTitle}</p>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#ECFDF5] border border-[#A7F3D0] text-[11px] font-mono-tabular font-bold text-[#059669]">
            <Clock className="w-3 h-3" />
            <span>
              {t.etaLabel}: {formatClockWIB(syncedEta.etaTargetTimestamp)}
            </span>
          </span>
        </div>

        {draft.serviceType === 'monthly' && (
          <div>
            <p className="text-[11px] font-semibold text-[#64748B] mb-1.5">
              {t.pickDaysLabel}
            </p>
            <div className="grid grid-cols-7 gap-1">
              {t.daysList.map((day, idx) => {
                const canonical = CANONICAL_DAYS[idx];
                const selected = draft.scheduleDays.includes(canonical);
                return (
                  <button
                    key={canonical}
                    type="button"
                    onClick={() => handleToggleDay(canonical)}
                    className={`py-2 rounded-lg text-[10px] font-bold border cursor-pointer ${
                      selected
                        ? 'bg-[#059669] text-white border-[#059669]'
                        : 'bg-[#F8FAFC] text-[#475569] border-[#E2E8F0]'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-[10px] font-semibold text-[#64748B] mb-1">
              {t.startDateLabel}
            </label>
            <input
              type="date"
              value={draft.scheduleStartDate}
              onChange={(e) =>
                onChangeDraft({ ...draft, scheduleStartDate: e.target.value })
              }
              className="w-full min-h-[38px] px-2.5 py-1 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[11px] font-mono-tabular text-[#0F172A]"
            />
          </div>
          <div>
            <label
              htmlFor="custom-pickup-time"
              className="block text-[10px] font-semibold text-[#64748B] mb-1"
            >
              {t.timeSlotLabel}
            </label>
            <div className="relative">
              <input
                id="custom-pickup-time"
                type="time"
                value={extractTimeHHMM(draft.scheduleTime)}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    onChangeDraft({ ...draft, scheduleTime: `${val} WIB` });
                  }
                }}
                className="w-full min-h-[38px] px-2.5 py-1 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[11px] font-mono-tabular font-semibold text-[#0F172A] focus:outline-none focus:border-[#059669]"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-0.5">
          <p className="text-[10px] font-semibold text-[#64748B]">{t.quickPickTimeLabel}</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() =>
                onChangeDraft({
                  ...draft,
                  scheduleStartDate: getTodayLocalDateStr(),
                  scheduleTime: formatClockWIB(syncedEta.minArrivalTimestamp),
                })
              }
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono-tabular font-bold border cursor-pointer transition-colors ${
                draft.scheduleStartDate === getTodayLocalDateStr(nowMs) &&
                extractTimeHHMM(draft.scheduleTime) ===
                  formatClockHHMM(syncedEta.minArrivalTimestamp)
                  ? 'bg-[#059669] text-white border-[#059669]'
                  : 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0] hover:border-[#059669]'
              }`}
            >
              {t.fastestEtaChipLabel} ({formatClockHHMM(syncedEta.minArrivalTimestamp)})
            </button>
            {QUICK_PICKUP_TIMES.map((slot) => {
              const slotHHMM = extractTimeHHMM(slot);
              const isSelected = extractTimeHHMM(draft.scheduleTime) === slotHHMM;
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => onChangeDraft({ ...draft, scheduleTime: slot })}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono-tabular font-bold border cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[#059669] text-white border-[#059669]'
                      : 'bg-[#F8FAFC] text-[#475569] border-[#E2E8F0] hover:border-[#10B981]'
                  }`}
                >
                  {slotHHMM}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-[#64748B]">{t.customTimeHint}</p>

          {/* Sync Status Banner linking Jam Penjemputan <-> Estimasi Tiba */}
          {syncedEta.isAdjustedToFastest ? (
            <div className="p-2.5 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] space-y-1.5">
              <p className="text-[11px] font-semibold text-[#92400E] leading-snug">
                {t.etaAdjustedNote} (~{syncedEta.routeEtaMinutes} {t.minutesShort}).{' '}
                <span className="font-mono-tabular font-bold">
                  {t.etaLabel}: {formatClockWIB(syncedEta.etaTargetTimestamp)}
                </span>
              </p>
              <button
                type="button"
                onClick={() =>
                  onChangeDraft({
                    ...draft,
                    scheduleStartDate: getTodayLocalDateStr(),
                    scheduleTime: formatClockWIB(syncedEta.minArrivalTimestamp),
                  })
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#D97706] text-white text-[10px] font-bold cursor-pointer"
              >
                <Clock className="w-3 h-3" />
                <span>
                  {t.syncToFastestBtn} ({formatClockHHMM(syncedEta.minArrivalTimestamp)})
                </span>
              </button>
            </div>
          ) : (
            <div className="p-2.5 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] flex items-center justify-between gap-2 text-[11px]">
              <div className="min-w-0">
                <p className="font-bold text-[#065F46]">{t.etaSyncedBadge}</p>
                <p className="text-[10px] text-[#047857] leading-snug">
                  {t.etaSyncedNote} (~{syncedEta.routeEtaMinutes} {t.minutesShort})
                </p>
              </div>
              <span className="font-mono-tabular font-bold text-[#059669] shrink-0">
                {formatClockWIB(syncedEta.etaTargetTimestamp)}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Pre-Sorted Checkbox */}
      <section className="bg-white rounded-2xl border border-[#E2E8F0] p-3.5 shadow-xs">
        <label className="flex items-start gap-3 cursor-pointer">
          <button
            type="button"
            role="checkbox"
            aria-checked={draft.isSorted}
            onClick={() => onChangeDraft({ ...draft, isSorted: !draft.isSorted })}
            className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 cursor-pointer ${
              draft.isSorted
                ? 'bg-[#059669] border-[#059669] text-white'
                : 'bg-[#F8FAFC] border-[#94A3B8]'
            }`}
          >
            {draft.isSorted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#0F172A] flex items-center gap-1">
                <Recycle className="w-3.5 h-3.5 text-[#059669]" />
                {t.sortCheckboxTitle}
              </span>
              <span className="font-mono-tabular text-[11px] font-bold text-[#059669]">
                +25 pts
              </span>
            </div>
            <p className="text-[11px] text-[#64748B] mt-0.5">{t.sortCheckboxDesc}</p>
          </div>
        </label>
      </section>

      <button
        type="button"
        onClick={() => onChangeStep('checkout')}
        className="w-full min-h-[48px] rounded-2xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold flex items-center justify-between px-4 shadow-sm cursor-pointer"
      >
        <span>{t.proceedCheckoutBtn}</span>
        <span className="font-mono-tabular text-sm">{formatRupiah(pricing.subtotal)}</span>
      </button>
    </div>
  );
}
