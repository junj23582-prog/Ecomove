import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell,
  ClipboardList,
  Coins,
  Home,
  MapPin,
  User,
  X,
} from 'lucide-react';
import type {
  ChatChannel,
  ChatMessage,
  KtmExtractedInfo,
  Language,
  MobileTab,
  NotificationItem,
  PaymentMethod,
  PickupOrder,
  ServiceType,
  UserProfile,
  VABank,
} from './types/ecomove';
import {
  INITIAL_NOTIFICATIONS,
  MOCK_COURIERS,
  PRESET_LOCATIONS,
} from './data/mockData';
import { getT } from './i18n/translations';
import { playConfirmTone } from './utils/audio';
import { updateStoredAccountProfile } from './utils/authSecurity';
import {
  buildCourierRoute,
  calculateDistanceKm,
  computeSyncedPickupEta,
  estimateEtaMinutesFromDistance,
  formatClockWIB,
  getTodayLocalDateStr,
} from './utils/trackingSimulation';
import { MobileShell } from './components/MobileShell';
import { SplashScreen } from './components/SplashScreen';
import { AuthView } from './components/AuthView';
import { MobileHomeTab } from './components/MobileHomeTab';
import { MobileOrderTab, type OrderDraft } from './components/MobileOrderTab';
import { MobileActivityTab } from './components/MobileActivityTab';
import { MobileProfileTab } from './components/MobileProfileTab';
import { LanguageToggle } from './components/LanguageToggle';

type AppPhase = 'splash' | 'auth' | 'app';

function formatNowWIB(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm} WIB`;
}

function getOrdersStorageKey(email: string): string {
  return `ecomove_orders_v1_${email.trim().toLowerCase()}`;
}

function loadUserCompletedOrders(email: string): PickupOrder[] {
  try {
    const raw = localStorage.getItem(getOrdersStorageKey(email));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PickupOrder[]) : [];
  } catch {
    return [];
  }
}

function saveUserCompletedOrders(email: string, orders: PickupOrder[]): void {
  try {
    localStorage.setItem(getOrdersStorageKey(email), JSON.stringify(orders));
  } catch {
    // Ignore storage quota errors
  }
}

export default function App() {
  const [lang, setLang] = useState<Language>('id');
  const [phase, setPhase] = useState<AppPhase>('splash');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<MobileTab>('home');
  const [orderStep, setOrderStep] = useState<'form' | 'checkout'>('form');

  const [activeOrder, setActiveOrder] = useState<PickupOrder | null>(null);
  const [completedOrders, setCompletedOrders] = useState<PickupOrder[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>(
    INITIAL_NOTIFICATIONS
  );
  const [showNotifDrawer, setShowNotifDrawer] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'chat-welcome-cur-1',
      sender: 'system',
      channel: 'courier',
      senderName: 'EcoMove',
      text: 'Chat langsung Konsumen ↔ Kurir Tosa EcoMove Pontianak aktif',
      timeLabel: 'Online',
    },
    {
      id: 'chat-welcome-cur-2',
      sender: 'courier',
      channel: 'courier',
      senderName: 'Kurir Tosa EcoMove Pontianak',
      text: 'Halo kak! Saya kurir Tosa EcoMove. Silakan chat di sini untuk patokan rumah/gang, jam jemput, atau kondisi sampah ya.',
      timeLabel: 'Sekarang',
    },
    {
      id: 'chat-welcome-col-1',
      sender: 'system',
      channel: 'collector',
      senderName: 'EcoMove',
      text: 'EcoMove menghubungkan Anda langsung dengan Pengepul Mitra Pontianak',
      timeLabel: 'Online',
    },
    {
      id: 'chat-welcome-col-2',
      sender: 'collector',
      channel: 'collector',
      senderName: 'Gudang Kapuas Daur Lestari',
      text: 'Halo! Kami pengepul mitra EcoMove Pontianak. Silakan chat di sini jika ada info pilahan sampah atau pertanyaan gudang.',
      timeLabel: 'Sekarang',
    },
  ]);
  const [isCollectorTyping, setIsCollectorTyping] = useState(false);
  const completedOrderIdsRef = useRef<Set<string>>(new Set());
  const arrivedAnnouncedIdsRef = useRef<Set<string>>(new Set());
  const lastCourierPlateRef = useRef<string | null>(null);
  const usedCourierPlatesRef = useRef<Set<string>>(new Set());
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [draft, setDraft] = useState<OrderDraft>(() => {
    const today = getTodayLocalDateStr();
    const initialEta = computeSyncedPickupEta({
      location: PRESET_LOCATIONS[0],
      isExpress: false,
    });
    return {
      serviceType: 'ondemand',
      isExpress: false,
      isSorted: true,
      scheduleDays: ['Senin', 'Rabu', 'Jumat'],
      scheduleStartDate: today,
      scheduleTime: formatClockWIB(initialEta.etaTargetTimestamp),
      location: PRESET_LOCATIONS[0],
    };
  });

  const t = getT(lang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (user?.email) {
      saveUserCompletedOrders(user.email, completedOrders);
    }
  }, [user?.email, completedOrders]);

  const completeOrderSnapshot = useCallback((order: PickupOrder) => {
    if (completedOrderIdsRef.current.has(order.id)) return;
    completedOrderIdsRef.current.add(order.id);

    playConfirmTone();
    const now = Date.now();
    const nowStr = formatNowWIB();
    const { collectorHub } = buildCourierRoute(order.location);
    const distToHub = calculateDistanceKm(
      order.location.lat,
      order.location.lng,
      collectorHub.lat,
      collectorHub.lng
    );
    const collectorEtaMin = estimateEtaMinutesFromDistance(distToHub, false);
    const finishedOrder: PickupOrder = {
      ...order,
      status: 'completed',
      actualArrivalTime: order.actualArrivalTime || nowStr,
      completedTime: nowStr,
      collectorEtaMinutesInitial: collectorEtaMin,
      collectorEtaTimestamp: now + collectorEtaMin * 60 * 1000,
    };

    setActiveOrder(finishedOrder);
    setCompletedOrders((prev) =>
      prev.some((o) => o.id === finishedOrder.id) ? prev : [finishedOrder, ...prev]
    );

    setNotifications((prev) => [
      {
        id: `notif-done-${now}`,
        titleId: `Selesai Diangkut (${order.id})`,
        titleEn: `Pickup Completed (${order.id})`,
        bodyId: `Sampah di ${order.location.address} selesai diangkut. Foto bukti Sebelum & Sesudah sudah tersedia.`,
        bodyEn: `Waste at ${order.location.address} collected. Before & After proof photos are ready.`,
        timeLabel: 'Baru',
        read: false,
      },
      ...prev,
    ]);

    setChatMessages((prev) => [
      ...prev,
      {
        id: `chat-done-sys-${now}`,
        sender: 'system',
        senderName: 'EcoMove',
        text: `Kotak "Selesai Diangkut" otomatis tercentang (${order.id}) · Foto bukti diunggah`,
        timeLabel: nowStr,
      },
      {
        id: `chat-done-cur-${now}`,
        sender: 'courier',
        channel: 'courier',
        senderName: `${order.courier.name} (${order.courier.plateNumber})`,
        text: `Sampah di ${order.location.address} sudah selesai saya angkut bersih ke Tosa dan foto bukti Sebelum & Sesudah sudah terunggah ya kak!`,
        timeLabel: nowStr,
      },
      {
        id: `chat-done-col-${now}`,
        sender: 'collector',
        channel: 'collector',
        senderName: collectorHub.name,
        text: `Muatan sampah (${order.id}) dari kurir ${order.courier.name} sedang menuju gudang ${collectorHub.name}.`,
        timeLabel: nowStr,
      },
    ]);

    setUser((prev) => {
      if (!prev) return prev;
      const addedKg = 2.8;
      const addedOrganic = 1.6;
      const addedInorganic = 1.2;
      const nextHistory = prev.impact.monthlyHistory.map((item, idx) =>
        idx === prev.impact.monthlyHistory.length - 1
          ? { ...item, kg: Number((item.kg + addedKg).toFixed(1)) }
          : item
      );
      return {
        ...prev,
        impact: {
          ...prev.impact,
          totalKgThisMonth: Number((prev.impact.totalKgThisMonth + addedKg).toFixed(1)),
          organicKg: Number((prev.impact.organicKg + addedOrganic).toFixed(1)),
          inorganicKg: Number((prev.impact.inorganicKg + addedInorganic).toFixed(1)),
          co2ReducedKg: Number((prev.impact.co2ReducedKg + 2.2).toFixed(1)),
          pickupsCompleted: prev.impact.pickupsCompleted + 1,
          monthlyHistory: nextHistory,
        },
      };
    });
  }, []);

  // Auto-advance: searching (2s) -> enroute -> arrived (at ETA=0) -> completed (3.5s auto-verify)
  useEffect(() => {
    if (!activeOrder) return;
    if (activeOrder.status === 'searching') {
      const timer = setTimeout(() => {
        setActiveOrder((prev) =>
          prev && prev.status === 'searching' ? { ...prev, status: 'enroute' } : prev
        );
      }, 2000);
      return () => clearTimeout(timer);
    }
    if (activeOrder.status === 'enroute') {
      const msUntilArrive = Math.max(0, activeOrder.etaTargetTimestamp - Date.now());
      const safeDelay = Math.min(2_147_000_000, msUntilArrive);
      const timer = setTimeout(() => {
        if (Date.now() < activeOrder.etaTargetTimestamp - 500) return;
        playConfirmTone();
        const nowStr = formatNowWIB();
        setActiveOrder((prev) =>
          prev && prev.status === 'enroute'
            ? {
                ...prev,
                status: 'arrived',
                etaTargetTimestamp: Date.now(),
                actualArrivalTime: nowStr,
              }
            : prev
        );
      }, safeDelay);
      return () => clearTimeout(timer);
    }
    if (activeOrder.status === 'arrived') {
      if (!arrivedAnnouncedIdsRef.current.has(activeOrder.id)) {
        arrivedAnnouncedIdsRef.current.add(activeOrder.id);
        const nowStr = formatNowWIB();
        setChatMessages((prev) => [
          ...prev,
          {
            id: `chat-arrived-${Date.now()}`,
            sender: 'system',
            senderName: 'EcoMove',
            text: `Kurir ${activeOrder.courier.name} tiba di lokasi jemput (${activeOrder.location.address})`,
            timeLabel: nowStr,
          },
        ]);
      }

      const timer = setTimeout(() => {
        completeOrderSnapshot(activeOrder);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [activeOrder, completeOrderSnapshot]);

  const handleSplashFinish = useCallback(() => {
    setPhase((prev) => (prev === 'splash' ? 'auth' : prev));
  }, []);

  const handleAuthenticated = (authenticatedUser: UserProfile) => {
    const savedOrders = loadUserCompletedOrders(authenticatedUser.email);
    completedOrderIdsRef.current = new Set(savedOrders.map((o) => o.id));
    arrivedAnnouncedIdsRef.current = new Set();
    lastCourierPlateRef.current = savedOrders[0]?.courier.plateNumber ?? null;
    usedCourierPlatesRef.current = new Set(
      savedOrders.map((o) => o.courier.plateNumber)
    );
    setCompletedOrders(savedOrders);
    setActiveOrder(null);
    setUser(authenticatedUser);
    setPhase('app');
    setActiveTab('home');
    setOrderStep('form');
  };

  const handleLogout = () => {
    lastCourierPlateRef.current = null;
    usedCourierPlatesRef.current.clear();
    setUser(null);
    setActiveOrder(null);
    setCompletedOrders([]);
    setShowNotifDrawer(false);
    setPhase('auth');
  };

  const handleQuickSelectService = (service: ServiceType) => {
    setDraft((prev) => {
      if (service === 'express') {
        const fastestExpress = computeSyncedPickupEta({
          location: prev.location,
          isExpress: true,
          nowMs: Date.now(),
        });
        return {
          ...prev,
          serviceType: service,
          isExpress: true,
          scheduleStartDate: getTodayLocalDateStr(),
          scheduleTime: formatClockWIB(fastestExpress.minArrivalTimestamp),
        };
      }
      return {
        ...prev,
        serviceType: service,
        isExpress: false,
      };
    });
    setOrderStep('form');
    setActiveTab('order');
  };

  const handleTogglePauseSubscription = (
    paused: boolean,
    startDate: string,
    endDate: string
  ) => {
    setUser((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        subscription: {
          ...prev.subscription,
          paused,
          pauseStartDate: startDate,
          pauseEndDate: endDate,
        },
      };
    });
  };

  const handleRedeemPoints = (pointsCost: number, discountAmount: number): boolean => {
    if (!user || user.ecoPoints < pointsCost) return false;
    playConfirmTone();
    const newVoucher = {
      id: `vch-${Date.now()}`,
      code: `ECO${discountAmount / 1000}K`,
      discountAmount,
      labelId: `Potongan Rp ${discountAmount.toLocaleString('id-ID')} (Tukar Poin)`,
      labelEn: `Rp ${discountAmount.toLocaleString('id-ID')} Off (Points)`,
      used: false,
    };
    setUser((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        ecoPoints: prev.ecoPoints - pointsCost,
        vouchers: [newVoucher, ...prev.vouchers],
      };
    });
    return true;
  };

  const handleConfirmOrder = (params: {
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
  }) => {
    if (!user) return;
    playConfirmTone();

    const previousPlate =
      activeOrder?.courier.plateNumber ??
      lastCourierPlateRef.current ??
      completedOrders[0]?.courier.plateNumber ??
      null;

    let candidateCouriers = MOCK_COURIERS.filter(
      (c) =>
        !usedCourierPlatesRef.current.has(c.plateNumber) &&
        c.plateNumber !== previousPlate
    );

    if (candidateCouriers.length === 0) {
      usedCourierPlatesRef.current.clear();
      candidateCouriers = MOCK_COURIERS.filter(
        (c) => c.plateNumber !== previousPlate
      );
      if (candidateCouriers.length === 0) {
        candidateCouriers = MOCK_COURIERS;
      }
    }

    const courier =
      candidateCouriers[Math.floor(Math.random() * candidateCouriers.length)];
    lastCourierPlateRef.current = courier.plateNumber;
    usedCourierPlatesRef.current.add(courier.plateNumber);
    const isExpressOrder = draft.serviceType === 'express' || draft.isExpress;
    const syncedEta = computeSyncedPickupEta({
      location: draft.location,
      isExpress: isExpressOrder,
      scheduleStartDate: draft.scheduleStartDate,
      scheduleTime: draft.scheduleTime,
      nowMs: Date.now(),
    });
    const syncedScheduleTime = syncedEta.isAdjustedToFastest
      ? formatClockWIB(syncedEta.etaTargetTimestamp)
      : draft.scheduleTime;
    const etaMinutes = syncedEta.etaMinutesTotal;
    const etaTargetTimestamp = syncedEta.etaTargetTimestamp;

    const newOrder: PickupOrder = {
      id: `ECO-${Math.floor(100000 + Math.random() * 900000)}`,
      serviceType: draft.serviceType,
      isExpress: isExpressOrder,
      isSorted: draft.isSorted,
      basePrice: params.basePrice,
      studentDiscount: params.studentDiscount,
      expressFee: params.expressFee,
      voucherDiscount: params.voucherDiscount,
      totalPrice: params.totalPrice,
      earnedPoints: params.earnedPoints,
      status: 'searching',
      etaMinutesInitial: etaMinutes,
      etaTargetTimestamp,
      actualArrivalTime: null,
      completedTime: null,
      beforeTimeLabel: formatNowWIB(),
      courier,
      location: { ...draft.location },
      paymentMethod: params.paymentMethod,
      vaBank: params.vaBank,
      vaNumber: params.vaNumber,
      scheduleDays: draft.serviceType === 'monthly' ? draft.scheduleDays : undefined,
      scheduleStartDate: draft.scheduleStartDate,
      scheduleTime: syncedScheduleTime,
      createdAt: formatNowWIB(),
    };

    setUser((prev) => {
      if (!prev) return prev;
      const updatedVouchers = prev.vouchers.map((v) =>
        v.id === params.voucherId ? { ...v, used: true } : v
      );
      const updatedSub =
        draft.serviceType === 'monthly'
          ? {
              ...prev.subscription,
              active: true,
              startDate: draft.scheduleStartDate,
              scheduleDays: draft.scheduleDays,
              scheduleTime: syncedScheduleTime,
              remainingPickups: 12,
            }
          : prev.subscription;

      return {
        ...prev,
        ecoPoints: prev.ecoPoints + params.earnedPoints,
        vouchers: updatedVouchers,
        subscription: updatedSub,
      };
    });

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        titleId: `Kurir Menuju Lokasi (${newOrder.id})`,
        titleEn: `Courier Dispatched (${newOrder.id})`,
        bodyId: `${courier.name} (${courier.plateNumber}) sedang menuju titik jemput Anda.`,
        bodyEn: `${courier.name} (${courier.plateNumber}) is on the way to your pickup pin.`,
        timeLabel: 'Baru',
        read: false,
      },
      ...prev,
    ]);

    const { collectorHub } = buildCourierRoute(draft.location);
    const nowStr = formatNowWIB();
    setChatMessages((prev) => [
      ...prev,
      {
        id: `chat-ord-sys-${Date.now()}`,
        sender: 'system',
        senderName: 'EcoMove',
        text: `Pesanan ${newOrder.id} (${syncedScheduleTime}) terhubung dengan Kurir ${courier.name} & ${collectorHub.name}`,
        timeLabel: nowStr,
      },
      {
        id: `chat-ord-cur-${Date.now() + 1}`,
        sender: 'courier',
        channel: 'courier',
        senderName: `${courier.name} (${courier.plateNumber})`,
        text: `Halo ${user.name}! Saya ${courier.name} dengan ${courier.vehicle} (${courier.plateNumber}), menuju ${draft.location.address} (Est. tiba ${formatClockWIB(etaTargetTimestamp)}). Chat saya kalau ada patokan pagar/gang ya!`,
        timeLabel: nowStr,
      },
      {
        id: `chat-ord-col-${Date.now() + 2}`,
        sender: 'collector',
        channel: 'collector',
        senderName: collectorHub.name,
        text: `Pesanan ${newOrder.id} tercatat di ${collectorHub.name}. Kurir kami sedang mengarah ke lokasi Anda.`,
        timeLabel: nowStr,
      },
    ]);

    setActiveOrder(newOrder);
    setOrderStep('form');
    setActiveTab('activity');
  };

  const handleSimulateArrive = () => {
    playConfirmTone();
    const nowStr = formatNowWIB();
    setActiveOrder((prev) =>
      prev
        ? {
            ...prev,
            status: 'arrived',
            etaTargetTimestamp: Date.now(),
            actualArrivalTime: nowStr,
          }
        : prev
    );
  };

  const handleFastForwardEta = (minutes: number) => {
    const shiftMs = minutes * 60 * 1000;
    const now = Date.now();
    setActiveOrder((prev) => {
      if (!prev) return prev;
      if (prev.status === 'searching' || prev.status === 'enroute') {
        const nextEtaTs = prev.etaTargetTimestamp - shiftMs;
        if (nextEtaTs <= now) {
          playConfirmTone();
          return {
            ...prev,
            status: 'arrived',
            etaTargetTimestamp: now,
            actualArrivalTime: formatNowWIB(),
          };
        }
        return {
          ...prev,
          status: 'enroute',
          etaTargetTimestamp: nextEtaTs,
        };
      }
      if (prev.status === 'completed' && prev.collectorEtaTimestamp) {
        return {
          ...prev,
          collectorEtaTimestamp: Math.max(now, prev.collectorEtaTimestamp - shiftMs),
        };
      }
      return prev;
    });
  };

  const handleSimulateComplete = () => {
    if (!activeOrder) return;
    completeOrderSnapshot(activeOrder);
  };

  const handleSendChatMessage = (text: string, channel: ChatChannel = 'courier') => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const nowStr = formatNowWIB();
    const consumerMsg: ChatMessage = {
      id: `chat-usr-${Date.now()}`,
      sender: 'consumer',
      channel,
      senderName: user?.name || 'Konsumen',
      text: trimmed,
      timeLabel: nowStr,
    };
    setChatMessages((prev) => [...prev, consumerMsg]);
    setIsCollectorTyping(true);

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    const orderSnap = activeOrder;
    const locSnap = activeOrder ? activeOrder.location : draft.location;
    const { collectorHub } = buildCourierRoute(locSnap);
    const courierLabel = orderSnap
      ? `${orderSnap.courier.name} (${orderSnap.courier.plateNumber})`
      : 'Kurir Tosa EcoMove';
    const collectorLabel = collectorHub.name;

    typingTimerRef.current = setTimeout(() => {
      const q = trimmed.toLowerCase();
      let reply = '';

      if (channel === 'courier') {
        if (/mana|tiba|sampai|lama|eta|posisi|dekat/.test(q)) {
          if (orderSnap?.status === 'completed') {
            reply = `Saya sudah selesai angkut sampahnya ya kak di ${locSnap.address}, sekarang sedang bawa muatan ke ${collectorHub.name}.`;
          } else if (orderSnap?.status === 'arrived') {
            reply = `Saya (${orderSnap.courier.name}) sudah tepat di depan ${locSnap.address}, sedang muat sampah ke bak Tosa.`;
          } else if (orderSnap) {
            const remMin = Math.max(
              1,
              Math.ceil((orderSnap.etaTargetTimestamp - Date.now()) / 60000)
            );
            reply = `Saya lagi meluncur ke ${locSnap.address} pakai ${orderSnap.courier.vehicle} (${orderSnap.courier.plateNumber}), perkiraan tiba ~${remMin} menit lagi (${formatClockWIB(orderSnap.etaTargetTimestamp)}).`;
          } else {
            reply = `Saya sedang patroli Tosa di Pontianak. Silakan buat penjemputan di tab Jemput nanti saya langsung meluncur ke lokasi kakak!`;
          }
        } else if (/pagar|depan|gang|gg|blok|kost|asrama|komplek|perum|lokasi|patokan/.test(q)) {
          const detail = locSnap.housingName || locSnap.gang || locSnap.address;
          reply = `Siap kak! Patokan ${detail} sudah saya catat. Nanti sampai depan saya bunyikan klakson pelan & kabari di chat.`;
        } else if (/pilah|organik|plastik|kardus|foto|bukti|siap/.test(q)) {
          reply = `Mantap kak! Begitu saya angkut ke Tosa, status "Selesai Diangkut" langsung tercentang & foto bukti Sebelum & Sesudah otomatis masuk ke aplikasi.`;
        } else {
          reply = `Siap kak, pesan diterima oleh kurir ${orderSnap ? orderSnap.courier.name : 'Tosa EcoMove'}. Saya pastikan jemput sesuai jadwal & titik lokasi!`;
        }
      } else {
        if (/mana|tiba|sampai|lama|eta|posisi|armada/.test(q)) {
          if (orderSnap?.status === 'completed') {
            reply = `Sampah sudah selesai diangkut & bukti fotonya sudah tampil ya kak. Armada sedang menuju ${collectorHub.name}.`;
          } else if (orderSnap) {
            const remMin = Math.max(
              1,
              Math.ceil((orderSnap.etaTargetTimestamp - Date.now()) / 60000)
            );
            reply = `Armada kurir kami (${orderSnap.courier.plateNumber}) menuju ${locSnap.address}, estimasi tiba sekitar ${remMin} menit lagi.`;
          } else {
            reply = `Tim pengepul ${collectorHub.name} siap menerima muatan pilahan dari Pontianak. Buat pesanan di tab Jemput untuk penjadwalan.`;
          }
        } else if (/pilah|organik|plastik|kardus|foto|bukti/.test(q)) {
          reply = `Terima kasih sudah memilah sampah! Pilahan Anda membantu proses daur ulang di ${collectorHub.name} lebih cepat & bernilai ekonomi.`;
        } else {
          reply = `Baik kak, pesan diterima oleh tim ${collectorHub.name}. Kami pastikan pengangkutan berjalan rapi & tepat waktu sesuai SOP EcoMove.`;
        }
      }

      setIsCollectorTyping(false);
      setChatMessages((prev) => [
        ...prev,
        {
          id: `chat-rep-${Date.now()}`,
          sender: channel === 'courier' ? 'courier' : 'collector',
          channel,
          senderName: channel === 'courier' ? courierLabel : collectorLabel,
          text: reply,
          timeLabel: formatNowWIB(),
        },
      ]);
    }, 900);
  };

  const handleDeleteHistoryOrder = (orderId: string) => {
    completedOrderIdsRef.current.delete(orderId);
    setCompletedOrders((prev) => prev.filter((o) => o.id !== orderId));
  };

  const handleClearHistory = () => {
    completedOrderIdsRef.current.clear();
    setCompletedOrders([]);
  };

  const handleToggleRoleDemo = () => {
    setUser((prev) => {
      if (!prev) return prev;
      const nextRole = prev.role === 'student' ? 'household' : 'student';
      const nextProfile: UserProfile = {
        ...prev,
        role: nextRole,
        ktmVerified: nextRole === 'student',
      };
      updateStoredAccountProfile(nextProfile);
      return nextProfile;
    });
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const bottomTabs: { id: MobileTab; label: string; icon: typeof Home }[] = [
    { id: 'home', label: t.navHome, icon: Home },
    { id: 'order', label: t.navOrder, icon: MapPin },
    { id: 'activity', label: t.navActivity, icon: ClipboardList },
    { id: 'profile', label: t.navProfile, icon: User },
  ];

  return (
    <MobileShell>
      {phase === 'splash' ? (
        <SplashScreen lang={lang} onFinish={handleSplashFinish} />
      ) : phase === 'auth' || !user ? (
        <AuthView
          lang={lang}
          onChangeLang={setLang}
          onAuthenticated={handleAuthenticated}
        />
      ) : (
        <>
          {/* Mobile Top Header Bar */}
          <header className="bg-gradient-to-r from-[#059669] via-[#0D9488] to-[#10B981] text-white px-4 py-3 flex items-center justify-between gap-2 shrink-0 z-20 shadow-sm">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="font-display text-xs font-bold text-white truncate">
                  {t.greeting}, {user.name}
                </p>
                <span className="text-[10px] font-bold text-[#065F46] bg-[#D1FAE5] px-1.5 py-0.5 rounded-md whitespace-nowrap shrink-0">
                  {user.role === 'student' ? t.memberStudentBadge : t.householdBadge}
                </span>
              </div>
              <p className="font-mono-tabular text-[11px] font-bold text-[#ECFDF5] flex items-center gap-1 mt-0.5">
                <Coins className="w-3 h-3 text-[#FDE68A]" />
                <span>{user.ecoPoints} EcoPoints</span>
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowNotifDrawer(true)}
                aria-label={t.notificationsTitle}
                className="relative w-9 h-9 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center text-white hover:bg-white/25 transition-colors cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#F59E0B] text-white text-[9px] font-bold flex items-center justify-center shadow-xs">
                    {unreadCount}
                  </span>
                )}
              </button>
              <LanguageToggle lang={lang} onChange={setLang} />
            </div>
          </header>

          {/* Scrollable Tab Viewport */}
          <main className="flex-1 min-h-0 overflow-y-auto mobile-scroll bg-[#F4F9F6]">
            {activeTab === 'home' && (
              <MobileHomeTab
                lang={lang}
                user={user}
                onQuickSelectService={handleQuickSelectService}
                onGoToProfile={() => setActiveTab('profile')}
              />
            )}
            {activeTab === 'order' && (
              <MobileOrderTab
                lang={lang}
                user={user}
                draft={draft}
                step={orderStep}
                onChangeStep={setOrderStep}
                onChangeDraft={setDraft}
                onConfirmOrder={handleConfirmOrder}
              />
            )}
            {activeTab === 'activity' && (
              <MobileActivityTab
                lang={lang}
                consumerName={user.name}
                activeOrder={activeOrder}
                completedOrders={completedOrders}
                userLocation={draft.location}
                chatMessages={chatMessages}
                isCollectorTyping={isCollectorTyping}
                onSendChatMessage={handleSendChatMessage}
                onDeleteHistoryOrder={handleDeleteHistoryOrder}
                onClearHistory={handleClearHistory}
                onSimulateArrive={handleSimulateArrive}
                onFastForwardEta={handleFastForwardEta}
                onSimulateComplete={handleSimulateComplete}
                onGoToOrder={() => {
                  setOrderStep('form');
                  setActiveTab('order');
                }}
              />
            )}
            {activeTab === 'profile' && (
              <MobileProfileTab
                lang={lang}
                user={user}
                onChangeLang={setLang}
                onUpdateName={(nextName) =>
                  setUser((prev) => {
                    if (!prev) return prev;
                    const nextProfile = { ...prev, name: nextName };
                    updateStoredAccountProfile(nextProfile);
                    return nextProfile;
                  })
                }
                onKtmScanned={(previewUrl, fileName, ktmInfo) =>
                  setUser((prev) => {
                    if (!prev) return prev;
                    const nextProfile: UserProfile = {
                      ...prev,
                      role: 'student',
                      ktmVerified: true,
                      ktmPreviewUrl: previewUrl,
                      ktmFileName: fileName,
                      ktmInfo: ktmInfo ?? prev.ktmInfo,
                    };
                    updateStoredAccountProfile(nextProfile);
                    return nextProfile;
                  })
                }
                onTogglePauseSubscription={handleTogglePauseSubscription}
                onRedeemPoints={handleRedeemPoints}
                onToggleRoleDemo={handleToggleRoleDemo}
                onLogout={handleLogout}
              />
            )}
          </main>

          {/* Fixed 4-Tab Bottom Navigation Bar */}
          <nav
            className="h-[62px] bg-white border-t border-[#E2E8F0] grid grid-cols-4 items-center shrink-0 z-20 shadow-[0_-4px_16px_rgba(15,23,42,0.04)]"
            aria-label="Bottom Navigation"
          >
            {bottomTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    if (tab.id !== 'order') {
                      setOrderStep('form');
                    }
                    setActiveTab(tab.id);
                  }}
                  className={`relative h-full flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
                    isActive ? 'text-[#059669]' : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  {isActive && (
                    <span
                      className="absolute top-0 w-8 h-[3px] rounded-b-full bg-[#059669]"
                      aria-hidden="true"
                    />
                  )}
                  <div
                    className={`px-2.5 py-0.5 rounded-xl transition-colors ${
                      isActive ? 'bg-[#ECFDF5]' : ''
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.4]' : 'stroke-[1.8]'}`} />
                  </div>
                  <span className="text-[10px] font-bold tracking-tight truncate max-w-[68px]">
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* In-Frame Notifications Drawer */}
          {showNotifDrawer && (
            <div
              className="absolute inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-end"
              role="dialog"
              aria-modal="true"
            >
              <div className="w-full max-h-[75%] bg-white rounded-t-3xl p-4 flex flex-col gap-3 shadow-2xl">
                <div className="w-10 h-1 bg-[#CBD5E1] rounded-full mx-auto shrink-0" />
                <div className="flex items-center justify-between gap-2 shrink-0">
                  <h2 className="font-display text-sm font-bold text-[#0F172A]">
                    {t.notificationsTitle}
                  </h2>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setNotifications((prev) =>
                            prev.map((n) => ({ ...n, read: true }))
                          )
                        }
                        className="text-[11px] font-bold text-[#059669] cursor-pointer"
                      >
                        {t.markAllRead}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowNotifDrawer(false)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[#64748B] cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="overflow-y-auto mobile-scroll divide-y divide-[#F1F5F9]">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`py-3 space-y-1 ${!n.read ? 'bg-[#ECFDF5]/40 -mx-1 px-1 rounded-xl' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-[#0F172A]">
                          {lang === 'id' ? n.titleId : n.titleEn}
                        </p>
                        <span className="text-[10px] font-mono-tabular text-[#64748B]">
                          {n.timeLabel}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#475569] leading-snug">
                        {lang === 'id' ? n.bodyId : n.bodyEn}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </MobileShell>
  );
}
