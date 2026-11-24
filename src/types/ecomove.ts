export type Language = 'id' | 'en';

export type UserRole = 'household' | 'student';

export type ServiceType = 'ondemand' | 'monthly' | 'express';

export type PaymentMethod = 'qris' | 'va' | 'cash';

export type VABank = 'BCA' | 'Mandiri' | 'BNI';

export type OrderStatus = 'searching' | 'enroute' | 'arrived' | 'completed';

export type MobileTab = 'home' | 'order' | 'activity' | 'profile';

export type LocationAreaType =
  | 'gang'
  | 'kost'
  | 'asrama'
  | 'perumahan'
  | 'komplek'
  | 'jalan';

export interface LocationSelection {
  lat: number;
  lng: number;
  address: string;
  district: string;
  note: string;
  areaType?: LocationAreaType;
  gang?: string;
  rt?: string;
  rw?: string;
  housingName?: string;
  houseNumber?: string;
}

export interface SubscriptionState {
  active: boolean;
  planLabel: string;
  startDate: string;
  endDate: string;
  remainingPickups: number;
  scheduleDays: string[];
  scheduleTime: string;
  paused: boolean;
  pauseStartDate: string;
  pauseEndDate: string;
  extendedDays: number;
}

export interface Voucher {
  id: string;
  code: string;
  discountAmount: number;
  labelId: string;
  labelEn: string;
  used: boolean;
}

export interface ImpactStats {
  totalKgThisMonth: number;
  organicKg: number;
  inorganicKg: number;
  co2ReducedKg: number;
  pickupsCompleted: number;
  monthlyHistory: { month: string; kg: number }[];
}

export interface KtmExtractedInfo {
  cardType: 'KTM' | 'Kartu Pelajar';
  campusName: string;
  nim: string;
  studentName: string;
  studyProgram?: string;
  copiedSummary: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  ktmVerified: boolean;
  ktmFileName?: string;
  ktmPreviewUrl?: string;
  ktmInfo?: KtmExtractedInfo;
  authProvider: 'email' | 'google';
  ecoPoints: number;
  vouchers: Voucher[];
  subscription: SubscriptionState;
  impact: ImpactStats;
}

export interface CourierInfo {
  name: string;
  vehicle: string;
  plateNumber: string;
  rating: number;
  phone: string;
  completedTrips: number;
}

export interface PickupOrder {
  id: string;
  serviceType: ServiceType;
  isExpress: boolean;
  isSorted: boolean;
  basePrice: number;
  studentDiscount: number;
  expressFee: number;
  voucherDiscount: number;
  totalPrice: number;
  earnedPoints: number;
  status: OrderStatus;
  etaMinutesInitial: number;
  etaTargetTimestamp: number;
  collectorEtaMinutesInitial?: number;
  collectorEtaTimestamp?: number;
  actualArrivalTime: string | null;
  completedTime: string | null;
  courier: CourierInfo;
  location: LocationSelection;
  paymentMethod: PaymentMethod;
  vaBank?: VABank;
  vaNumber?: string;
  scheduleDays?: string[];
  scheduleStartDate?: string;
  scheduleTime?: string;
  createdAt: string;
  beforeTimeLabel?: string;
}

export interface NotificationItem {
  id: string;
  titleId: string;
  titleEn: string;
  bodyId: string;
  bodyEn: string;
  timeLabel: string;
  read: boolean;
}

export type ChatChannel = 'courier' | 'collector';

export interface ChatMessage {
  id: string;
  sender: 'consumer' | 'courier' | 'collector' | 'system';
  channel?: ChatChannel;
  senderName: string;
  text: string;
  timeLabel: string;
}
