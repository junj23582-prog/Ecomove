import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  CheckSquare,
  Clock,
  Loader2,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  PlusCircle,
  ShieldCheck,
  Square,
  Star,
  Trash2,
  Truck,
} from 'lucide-react';
import type {
  ChatChannel,
  ChatMessage,
  Language,
  LocationSelection,
  PickupOrder,
} from '../types/ecomove';
import { formatRupiah, getT } from '../i18n/translations';
import { formatLocationDetail } from '../data/mockData';
import {
  buildCourierRoute,
  formatClockWIB,
  formatCountdown,
} from '../utils/trackingSimulation';
import { BeforeAfterProof } from './BeforeAfterProof';
import { CollectorChatCard } from './CollectorChatCard';
import { LiveTrackingMap } from './LiveTrackingMap';

interface MobileActivityTabProps {
  lang: Language;
  consumerName: string;
  activeOrder: PickupOrder | null;
  completedOrders: PickupOrder[];
  userLocation: LocationSelection;
  chatMessages: ChatMessage[];
  isCollectorTyping: boolean;
  onSendChatMessage: (text: string, channel: ChatChannel) => void;
  onDeleteHistoryOrder: (orderId: string) => void;
  onClearHistory: () => void;
  onSimulateArrive: () => void;
  onFastForwardEta: (minutes: number) => void;
  onSimulateComplete: () => void;
  onGoToOrder: () => void;
}

export function MobileActivityTab({
  lang,
  consumerName,
  activeOrder,
  completedOrders,
  userLocation,
  chatMessages,
  isCollectorTyping,
  onSendChatMessage,
  onDeleteHistoryOrder,
  onClearHistory,
  onSimulateArrive,
  onFastForwardEta,
  onSimulateComplete,
  onGoToOrder,
}: MobileActivityTabProps) {
  const t = getT(lang);
  const [subTab, setSubTab] = useState<'ongoing' | 'history'>('ongoing');
  const [chatChannel, setChatChannel] = useState<ChatChannel>('courier');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const chatSectionRef = useRef<HTMLDivElement | null>(null);

  const handleJumpToCourierChat = () => {
    setChatChannel('courier');
    chatSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const collectorInfo = useMemo(() => {
    const target = activeOrder ? activeOrder.location : userLocation;
    return buildCourierRoute(target).collectorHub;
  }, [activeOrder, userLocation]);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remainingSecondsTotal = activeOrder
    ? Math.max(0, Math.ceil((activeOrder.etaTargetTimestamp - nowMs) / 1000))
    : 0;

  const steps: { key: PickupOrder['status']; label: string }[] = [
    { key: 'searching', label: t.statusSearching },
    { key: 'enroute', label: t.statusEnroute },
    { key: 'arrived', label: t.statusArrived },
    { key: 'completed', label: t.statusCompleted },
  ];

  const currentStepIndex = activeOrder
    ? steps.findIndex((s) => s.key === activeOrder.status)
    : -1;

  const hasHistory = completedOrders.length > 0;
  const effectiveSubTab = hasHistory ? subTab : 'ongoing';

  return (
    <div className="p-4 space-y-4 pb-6">
      <h2 className="font-display text-base font-bold text-[#0F172A]">
        {t.activityTitle}
      </h2>

      {/* Segmented Sub-Tabs: only show Riwayat & Bukti once user has completed an order */}
      {hasHistory && (
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#E2E8F0]">
          <button
            type="button"
            onClick={() => setSubTab('ongoing')}
            className={`py-2 min-h-[38px] rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              effectiveSubTab === 'ongoing'
                ? 'bg-white text-[#059669] shadow-xs'
                : 'text-[#64748B]'
            }`}
          >
            {t.tabOngoing}
          </button>
          <button
            type="button"
            onClick={() => setSubTab('history')}
            className={`py-2 min-h-[38px] rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              effectiveSubTab === 'history'
                ? 'bg-white text-[#059669] shadow-xs'
                : 'text-[#64748B]'
            }`}
          >
            {t.tabHistory} ({completedOrders.length})
          </button>
        </div>
      )}

      {effectiveSubTab === 'ongoing' ? (
        !activeOrder ? (
          <div className="space-y-3.5">
            <LiveTrackingMap
              lang={lang}
              activeOrder={null}
              userLocation={userLocation}
              nowMs={nowMs}
              onFocusOrderForm={onGoToOrder}
            />

            <CollectorChatCard
              lang={lang}
              consumerName={consumerName}
              collectorTitle={collectorInfo.name}
              activeChannel={chatChannel}
              onChangeChannel={setChatChannel}
              messages={chatMessages}
              isCollectorTyping={isCollectorTyping}
              onSendMessage={onSendChatMessage}
            />

            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 text-center space-y-2.5 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-[#ECFDF5] text-[#059669] flex items-center justify-center mx-auto">
                <Truck className="w-5 h-5" />
              </div>
              <h3 className="font-display text-xs font-bold text-[#0F172A]">
                {t.noActiveOrderTitle}
              </h3>
              <p className="text-[11px] text-[#64748B] leading-relaxed">
                {t.noActiveOrderDesc}
              </p>
              <p className="text-[10px] text-[#059669] font-medium leading-snug">
                {lang === 'id'
                  ? 'Riwayat lokasi & Foto Bukti Angkut (Sebelum & Sesudah) akan muncul otomatis setelah Anda memesan penjemputan.'
                  : 'Location history & Before/After proof photos appear automatically only after you book a pickup.'}
              </p>
              <button
                type="button"
                onClick={onGoToOrder}
                className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[38px] rounded-xl bg-[#059669] text-white text-xs font-bold cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{t.orderNowBtn}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3.5">
            {/* Live Courier & Collector Detection Map */}
            <LiveTrackingMap
              lang={lang}
              activeOrder={activeOrder}
              userLocation={userLocation}
              nowMs={nowMs}
            />

            {/* SOP & Live Countdown Card */}
            <section className="bg-white rounded-2xl border border-[#A7F3D0] p-3.5 space-y-3 shadow-xs">
              <div className="flex items-start gap-2.5 pb-2.5 border-b border-[#F1F5F9]">
                <ShieldCheck className="w-4 h-4 text-[#059669] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-[#059669]">{t.sopBannerTitle}</p>
                  <p className="text-[11px] text-[#64748B] leading-snug mt-0.5">
                    {t.sopBannerDesc}
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1.5">
                {activeOrder.scheduleTime && (
                  <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                    <span>{t.timeSlotLabel}</span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-[#ECFDF5] border border-[#A7F3D0] text-[9px] font-bold text-[#059669]">
                        {t.etaSyncedBadge}
                      </span>
                      <span className="font-mono-tabular font-bold text-[#0F172A]">
                        {activeOrder.scheduleTime}
                      </span>
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#059669]" />
                    {t.etaLabel}
                  </span>
                  <span className="font-mono-tabular font-bold text-[#0F172A]">
                    {formatClockWIB(activeOrder.etaTargetTimestamp)}
                  </span>
                </div>

                {activeOrder.status === 'arrived' || activeOrder.status === 'completed' ? (
                  <p className="text-xs font-bold text-[#059669] flex items-center gap-1 pt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{t.arrivedOnTime}</span>
                  </p>
                ) : (
                  <p className="font-mono-tabular text-sm font-bold text-[#059669]">
                    {t.remainingCountdownLabel} {formatCountdown(remainingSecondsTotal, lang)}
                  </p>
                )}
              </div>

              {/* 4-Step Auto-Checkbox SOP Progress Grid */}
              <div className="grid grid-cols-2 gap-2">
                {steps.map((s, idx) => {
                  const done = idx <= currentStepIndex;
                  const active = idx === currentStepIndex;
                  return (
                    <div
                      key={s.key}
                      className={`p-2 rounded-xl border text-[11px] font-semibold flex items-center justify-between transition-colors ${
                        done
                          ? 'bg-[#ECFDF5] border-[#10B981] text-[#065F46]'
                          : active
                          ? 'bg-[#ECFDF5]/60 border-[#10B981] text-[#059669]'
                          : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#94A3B8]'
                      }`}
                    >
                      <span className="truncate">{s.label}</span>
                      {done ? (
                        <CheckSquare className="w-4 h-4 text-[#059669] shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-[#CBD5E1] shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>

              {activeOrder.status === 'arrived' && (
                <div className="p-2.5 rounded-xl bg-[#FEF3C7]/75 border border-[#FDE68A] flex items-center gap-2 text-[11px] font-semibold text-[#92400E]">
                  <Loader2 className="w-4 h-4 text-[#D97706] animate-spin shrink-0" />
                  <span className="leading-snug">{t.sopAutoCompleting}</span>
                </div>
              )}

              {activeOrder.status === 'completed' && (
                <div className="p-2.5 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] flex items-center gap-2 text-[11px] font-semibold text-[#065F46]">
                  <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0" />
                  <span className="leading-snug">{t.sopAutoCompletedNote}</span>
                </div>
              )}
            </section>

            {/* Automatic Before & After Proof Photos shown immediately when Selesai Diangkut auto-checks */}
            {activeOrder.status === 'completed' && (
              <BeforeAfterProof
                lang={lang}
                courierName={activeOrder.courier.name}
                address={activeOrder.location.address}
                location={activeOrder.location}
                beforeTime={activeOrder.beforeTimeLabel}
                completedTime={activeOrder.completedTime}
              />
            )}

            {/* Direct Intermediary Chat: Consumer <-> Courier / Collector */}
            <div ref={chatSectionRef}>
              <CollectorChatCard
                lang={lang}
                consumerName={consumerName}
                collectorTitle={collectorInfo.name}
                courierName={activeOrder.courier.name}
                courierPlate={activeOrder.courier.plateNumber}
                activeChannel={chatChannel}
                onChangeChannel={setChatChannel}
                messages={chatMessages}
                isCollectorTyping={isCollectorTyping}
                onSendMessage={onSendChatMessage}
              />
            </div>

            {/* Courier & Tosa Card */}
            <section className="bg-white rounded-2xl border border-[#E2E8F0] p-3.5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#059669] text-white flex items-center justify-center font-bold text-sm shrink-0">
                    {activeOrder.courier.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#0F172A] truncate">
                      {activeOrder.courier.name}
                    </p>
                    <p className="text-[11px] text-[#64748B] truncate">
                      {activeOrder.courier.vehicle}
                    </p>
                    <p className="text-[11px] font-mono-tabular font-bold text-[#059669] flex items-center gap-1.5 mt-0.5">
                      <span>{activeOrder.courier.plateNumber}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-0.5 text-[#0F172A]">
                        <Star className="w-3 h-3 text-[#D97706] fill-[#D97706]" />
                        {activeOrder.courier.rating}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleJumpToCourierChat}
                    className="h-9 px-2.5 rounded-xl bg-[#059669] text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>{t.chatWithCourierBtn}</span>
                  </button>
                  <a
                    href={`tel:${activeOrder.courier.phone}`}
                    className="w-9 h-9 rounded-xl bg-[#ECFDF5] text-[#059669] flex items-center justify-center shrink-0"
                    aria-label="Call courier"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                </div>
              </div>

              <div className="pt-2 border-t border-[#F1F5F9] space-y-1 text-[11px] text-[#64748B]">
                <div className="flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#059669] shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[#0F172A] font-medium">{activeOrder.location.address}</p>
                    {formatLocationDetail(activeOrder.location) && (
                      <p className="font-semibold text-[#059669]">
                        {formatLocationDetail(activeOrder.location)}
                      </p>
                    )}
                  </div>
                </div>
                {activeOrder.scheduleTime && (
                  <div className="flex justify-between">
                    <span>{t.pickupScheduleSelectedLabel}:</span>
                    <span className="font-mono-tabular font-bold text-[#059669]">
                      {activeOrder.scheduleStartDate
                        ? `${activeOrder.scheduleStartDate} · `
                        : ''}
                      {activeOrder.scheduleTime}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>{t.actualArrivalLabel}:</span>
                  <span className="font-mono-tabular font-bold text-[#0F172A]">
                    {activeOrder.actualArrivalTime || t.waitingArrival}
                  </span>
                </div>
              </div>
            </section>

            {/* Demo Simulation Controls */}
            <section className="bg-white rounded-2xl border border-[#E2E8F0] p-3.5 space-y-2 shadow-xs">
              <p className="text-[11px] font-bold text-[#059669] flex items-center gap-1">
                <Navigation className="w-3.5 h-3.5" />
                <span>{t.simControlsLabel}</span>
              </p>

              {(activeOrder.status === 'searching' || activeOrder.status === 'enroute') && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onFastForwardEta(3)}
                    className="w-full min-h-[40px] px-2 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] text-[11px] font-bold cursor-pointer"
                  >
                    {t.simFastForwardBtn}
                  </button>
                  <button
                    type="button"
                    onClick={onSimulateArrive}
                    className="w-full min-h-[40px] px-2 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-[#059669] text-[11px] font-bold cursor-pointer"
                  >
                    {t.simArriveBtn}
                  </button>
                </div>
              )}

              {activeOrder.status !== 'completed' ? (
                <button
                  type="button"
                  onClick={onSimulateComplete}
                  className="w-full min-h-[42px] rounded-xl bg-[#059669] text-white text-xs font-bold cursor-pointer"
                >
                  {t.simCompleteBtn}
                </button>
              ) : (
                <div className="space-y-2">
                  {activeOrder.collectorEtaTimestamp &&
                    activeOrder.collectorEtaTimestamp > nowMs && (
                      <button
                        type="button"
                        onClick={() => onFastForwardEta(3)}
                        className="w-full min-h-[40px] px-2 rounded-xl bg-[#FEF3C7] border border-[#FDE68A] text-[#92400E] text-[11px] font-bold cursor-pointer"
                      >
                        {t.simFastForwardBtn}
                      </button>
                    )}
                  <button
                    type="button"
                    onClick={onGoToOrder}
                    className="w-full min-h-[42px] rounded-xl bg-[#059669] text-white text-xs font-bold cursor-pointer"
                  >
                    {t.newPickupBtn}
                  </button>
                </div>
              )}
            </section>
          </div>
        )
      ) : (
        /* History & Before-After Proof Tab */
        <div className="space-y-4">
          {completedOrders.length === 0 ? (
            <p className="text-center text-xs text-[#64748B] py-8">{t.historyEmptyText}</p>
          ) : (
            <>
              {/* History Header & Clear All Control */}
              <div className="flex items-center justify-between gap-2 bg-white rounded-2xl border border-[#E2E8F0] px-3.5 py-2.5 shadow-xs">
                <span className="text-xs font-bold text-[#0F172A]">
                  {t.historyListTitle} ({completedOrders.length})
                </span>
                {confirmClearAll ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-[#B91C1C]">
                      {t.clearAllHistoryConfirm}
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfirmClearAll(false)}
                      className="px-2 py-1 rounded-lg bg-[#F1F5F9] text-[10px] font-bold text-[#475569] cursor-pointer"
                    >
                      {t.cancel}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onClearHistory();
                        setConfirmClearAll(false);
                        setConfirmDeleteId(null);
                        setSubTab('ongoing');
                      }}
                      className="px-2 py-1 rounded-lg bg-[#DC2626] text-white text-[10px] font-bold cursor-pointer"
                    >
                      {t.deleteHistoryConfirmBtn}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmClearAll(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] text-[11px] font-bold cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>{t.clearAllHistoryBtn}</span>
                  </button>
                )}
              </div>

              {completedOrders.map((item) => {
                const isConfirming = confirmDeleteId === item.id;
                return (
                  <div key={item.id} className="space-y-2.5">
                    <div className="bg-white rounded-2xl border border-[#E2E8F0] p-3.5 shadow-xs space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-mono-tabular font-bold text-[#059669]">
                          {item.id}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono-tabular font-bold text-[#0F172A]">
                            {formatRupiah(item.totalPrice)}
                          </span>
                          {!isConfirming ? (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(item.id)}
                              aria-label={`${t.deleteHistoryBtn} ${item.id}`}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] text-[10px] font-bold cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>{t.deleteHistoryBtn}</span>
                            </button>
                          ) : (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1 rounded-lg bg-[#F1F5F9] text-[10px] font-bold text-[#475569] cursor-pointer"
                              >
                                {t.cancel}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const isLastItem = completedOrders.length <= 1;
                                  onDeleteHistoryOrder(item.id);
                                  setConfirmDeleteId(null);
                                  if (isLastItem) {
                                    setSubTab('ongoing');
                                  }
                                }}
                                className="px-2 py-1 rounded-lg bg-[#DC2626] text-white text-[10px] font-bold cursor-pointer"
                              >
                                {t.deleteHistoryConfirmBtn}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <p className="text-xs font-semibold text-[#0F172A]">
                        {item.location.address}
                      </p>
                      {formatLocationDetail(item.location) && (
                        <p className="text-[11px] font-semibold text-[#059669]">
                          {formatLocationDetail(item.location)}
                        </p>
                      )}
                      <p className="text-[11px] text-[#64748B]">
                        {item.createdAt}
                        {item.scheduleTime ? ` · ${t.timeSlotLabel}: ${item.scheduleTime}` : ''} · +
                        {item.earnedPoints} EcoPoints
                      </p>
                    </div>

                    <BeforeAfterProof
                      lang={lang}
                      courierName={item.courier.name}
                      address={item.location.address}
                      location={item.location}
                      beforeTime={item.beforeTimeLabel}
                      completedTime={item.completedTime}
                    />
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
