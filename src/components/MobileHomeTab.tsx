import {
  ArrowRight,
  Calendar,
  ChevronRight,
  Leaf,
  PauseCircle,
  Sparkles,
  Truck,
  Zap,
} from 'lucide-react';
import type { Language, ServiceType, UserProfile } from '../types/ecomove';
import { getT } from '../i18n/translations';

interface MobileHomeTabProps {
  lang: Language;
  user: UserProfile;
  onQuickSelectService: (service: ServiceType) => void;
  onGoToProfile: () => void;
}

export function MobileHomeTab({
  lang,
  user,
  onQuickSelectService,
  onGoToProfile,
}: MobileHomeTabProps) {
  const t = getT(lang);
  const isStudent = user.role === 'student';

  return (
    <div className="p-4 space-y-4 pb-6">
      {/* Monthly Subscription Promo Banner */}
      <section className="rounded-2xl bg-gradient-to-br from-[#047857] via-[#059669] to-[#0D9488] text-white p-4 space-y-3 shadow-md shadow-[#059669]/15 relative overflow-hidden">
        <div
          className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/10 pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute right-8 -bottom-10 w-24 h-24 rounded-full bg-[#34D399]/20 pointer-events-none"
          aria-hidden="true"
        />
        <div className="relative z-10 space-y-1">
          <p className="text-[11px] font-bold text-[#A7F3D0] flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-[#FDE68A]" />
            <span>EcoMove Member</span>
          </p>
          <h2 className="font-display text-base font-bold leading-snug">
            {t.promoBannerTitle}
          </h2>
          <p className="text-[11px] text-[#ECFDF5] leading-relaxed">
            {t.promoBannerDesc}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onQuickSelectService('monthly')}
          className="relative z-10 inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-xl bg-white text-[#059669] text-xs font-bold hover:bg-[#ECFDF5] transition-colors shadow-xs cursor-pointer"
        >
          <span>{t.promoBannerBtn}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </section>

      {/* Emergency Express Quick Action Button */}
      <button
        type="button"
        onClick={() => onQuickSelectService('express')}
        className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-[#FFF7ED] to-[#FFEDD5] border border-[#FDBA74] hover:from-[#FFEDD5] hover:to-[#FED7AA] text-left flex items-center justify-between gap-3 transition-all cursor-pointer shadow-xs"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F59E0B] to-[#EA580C] text-white flex items-center justify-center shrink-0 shadow-xs">
            <Zap className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-[#9A3412] truncate">{t.panicBtn}</p>
            <p className="text-[11px] text-[#C2410C] truncate">{t.panicSub}</p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-[#C2410C] shrink-0" />
      </button>

      {/* Main 2 Service Cards */}
      <section className="space-y-2.5">
        <h3 className="font-display text-sm font-bold text-[#0F172A]">
          {t.chooseServiceTitle}
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {/* Daily On-Demand */}
          <button
            type="button"
            onClick={() => onQuickSelectService('ondemand')}
            className="text-left p-3.5 rounded-2xl bg-white border border-[#D1FAE5] hover:border-[#10B981] transition-all cursor-pointer shadow-xs flex flex-col justify-between gap-3"
          >
            <div className="space-y-1.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#10B981] to-[#059669] text-white flex items-center justify-center shadow-xs">
                <Truck className="w-4 h-4" />
              </div>
              <p className="font-display text-xs font-bold text-[#0F172A]">
                {t.serviceOnDemandTitle}
              </p>
              <p className="text-[11px] text-[#64748B] leading-snug">
                {t.serviceOnDemandDesc}
              </p>
            </div>
            <div className="pt-2 border-t border-[#ECFDF5]">
              {isStudent && (
                <p className="font-mono-tabular text-[10px] text-[#94A3B8] line-through">
                  Rp 10.000
                </p>
              )}
              <p className="font-mono-tabular text-sm font-bold text-[#059669]">
                {isStudent ? 'Rp 7.000' : 'Rp 10.000'}
                <span className="text-[10px] font-normal text-[#64748B]"> {t.perPickup}</span>
              </p>
            </div>
          </button>

          {/* Monthly Plan */}
          <button
            type="button"
            onClick={() => onQuickSelectService('monthly')}
            className="text-left p-3.5 rounded-2xl bg-white border border-[#CCFBF1] hover:border-[#0D9488] transition-all cursor-pointer shadow-xs flex flex-col justify-between gap-3"
          >
            <div className="space-y-1.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#14B8A6] to-[#0D9488] text-white flex items-center justify-center shadow-xs">
                <Calendar className="w-4 h-4" />
              </div>
              <p className="font-display text-xs font-bold text-[#0F172A]">
                {t.serviceMonthlyTitle}
              </p>
              <p className="text-[11px] text-[#64748B] leading-snug">
                {t.serviceMonthlyDesc}
              </p>
            </div>
            <div className="pt-2 border-t border-[#F0FDFA]">
              {isStudent && (
                <p className="font-mono-tabular text-[10px] text-[#94A3B8] line-through">
                  Rp 150.000
                </p>
              )}
              <p className="font-mono-tabular text-sm font-bold text-[#0D9488]">
                {isStudent ? 'Rp 100.000' : 'Rp 150.000'}
                <span className="text-[10px] font-normal text-[#64748B]"> {t.perMonth}</span>
              </p>
            </div>
          </button>
        </div>
      </section>

      {/* Nearest Pickup Schedule Shortcut */}
      <button
        type="button"
        onClick={onGoToProfile}
        className="w-full text-left p-3.5 rounded-2xl bg-white border border-[#E2E8F0] hover:border-[#10B981] transition-colors cursor-pointer shadow-xs flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              user.subscription.paused
                ? 'bg-[#FEF3C7] text-[#D97706]'
                : 'bg-[#E0F2FE] text-[#0284C7]'
            }`}
          >
            {user.subscription.paused ? (
              <PauseCircle className="w-5 h-5" />
            ) : (
              <Calendar className="w-5 h-5" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-[#64748B]">
              {t.nearestScheduleTitle}
            </p>
            {user.subscription.paused ? (
              <p className="text-xs font-bold text-[#B45309] truncate">
                {t.nearestSchedulePaused} ({user.subscription.pauseStartDate} -{' '}
                {user.subscription.pauseEndDate})
              </p>
            ) : (
              <p className="text-xs font-bold text-[#0F172A] truncate">
                {user.subscription.scheduleDays[0] || 'Senin'}, {user.subscription.scheduleTime}
              </p>
            )}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-[#94A3B8] shrink-0" />
      </button>

      {/* Eco-Impact Summary Card */}
      <section className="p-4 rounded-2xl bg-gradient-to-r from-[#ECFDF5] to-[#F0FDFA] border border-[#A7F3D0] shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#059669] text-white flex items-center justify-center shrink-0 shadow-xs">
            <Leaf className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#047857]">
              {t.ecoImpactSummaryTitle}
            </p>
            <p className="font-mono-tabular text-lg font-bold text-[#059669]">
              {user.impact.totalKgThisMonth.toFixed(1)}{' '}
              <span className="text-xs font-medium text-[#065F46]">{t.ecoImpactKgUnit}</span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onGoToProfile}
          className="px-3 py-2 min-h-[36px] rounded-xl bg-white border border-[#A7F3D0] text-[#059669] text-[11px] font-bold hover:bg-[#D1FAE5] transition-colors cursor-pointer shrink-0"
        >
          {t.viewFullImpact}
        </button>
      </section>
    </div>
  );
}
