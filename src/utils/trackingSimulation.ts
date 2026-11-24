import type { LocationSelection, OrderStatus } from '../types/ecomove';

export interface RoadPoint {
  lat: number;
  lng: number;
  roadNameId: string;
  roadNameEn: string;
}

export interface CollectorFleetPoint {
  id: string;
  kind: 'courier' | 'collector';
  name: string;
  vehicle: string;
  plateNumber: string;
  lat: number;
  lng: number;
  areaLabelId: string;
  areaLabelEn: string;
  statusId: string;
  statusEn: string;
}

// Pontianak arterial junctions & collector hubs for realistic route paths
const PONTIANAK_JUNCTIONS: RoadPoint[] = [
  {
    lat: -0.0556,
    lng: 109.349,
    roadNameId: 'Bundaran Digulis UNTAN',
    roadNameEn: 'UNTAN Digulis Roundabout',
  },
  {
    lat: -0.0472,
    lng: 109.3426,
    roadNameId: 'Jl. Ahmad Yani I (Ayani Mega Mall)',
    roadNameEn: 'Jl. Ahmad Yani I (Ayani Mega Mall)',
  },
  {
    lat: -0.0324,
    lng: 109.3418,
    roadNameId: 'Jl. Gajah Mada',
    roadNameEn: 'Jl. Gajah Mada',
  },
  {
    lat: -0.0226,
    lng: 109.3365,
    roadNameId: 'Jl. Tanjungpura',
    roadNameEn: 'Jl. Tanjungpura',
  },
  {
    lat: -0.0289,
    lng: 109.3174,
    roadNameId: 'Jl. Dr. Wahidin (Sungai Jawi)',
    roadNameEn: 'Jl. Dr. Wahidin (Sungai Jawi)',
  },
  {
    lat: -0.0682,
    lng: 109.3641,
    roadNameId: 'Jl. Sungai Raya Dalam',
    roadNameEn: 'Jl. Sungai Raya Dalam',
  },
  {
    lat: 0.0008,
    lng: 109.3224,
    roadNameId: 'Jl. Khatulistiwa (Pontianak Utara)',
    roadNameEn: 'Jl. Khatulistiwa (North Pontianak)',
  },
];

export const PONTIANAK_COLLECTOR_FLEET: CollectorFleetPoint[] = [
  {
    id: 'col-1',
    kind: 'collector',
    name: 'Gudang Kapuas Daur Lestari',
    vehicle: 'Truk Engkel Box (4 Ton)',
    plateNumber: 'KB 9124 PA',
    lat: -0.0645,
    lng: 109.3585,
    areaLabelId: 'Kawasan Bansir Laut / Sungai Raya Dalam',
    areaLabelEn: 'Bansir Laut / Sungai Raya Dalam Area',
    statusId: 'Pengepul Siap Terima Muatan',
    statusEn: 'Collector Ready for Intake',
  },
  {
    id: 'col-2',
    kind: 'collector',
    name: 'Sentra Plastik Khatulistiwa',
    vehicle: 'Pick-up Bak Tertutup (1.5 Ton)',
    plateNumber: 'KB 8410 QB',
    lat: -0.0315,
    lng: 109.3212,
    areaLabelId: 'Jl. Dr. Wahidin · Sungai Jawi',
    areaLabelEn: 'Jl. Dr. Wahidin · Sungai Jawi',
    statusId: 'Sedang Muat Plastik Terpilah',
    statusEn: 'Loading Sorted Plastics',
  },
  {
    id: 'cur-1',
    kind: 'courier',
    name: 'Rizky Pratama',
    vehicle: 'Tosa Eco-04',
    plateNumber: 'KB 4821 QA',
    lat: -0.0521,
    lng: 109.3458,
    areaLabelId: 'Melintas Jl. Prof. Dr. H. Hadari Nawawi',
    areaLabelEn: 'Passing Jl. Prof. Dr. H. Hadari Nawawi',
    statusId: 'Siaga Patroli Area UNTAN',
    statusEn: 'Patrolling UNTAN Zone',
  },
  {
    id: 'cur-2',
    kind: 'courier',
    name: 'Hendra Wijaya',
    vehicle: 'Tosa Eco-11',
    plateNumber: 'KB 6190 PB',
    lat: -0.0398,
    lng: 109.3412,
    areaLabelId: 'Melintas Jl. Ahmad Yani I · Pontianak Selatan',
    areaLabelEn: 'Passing Jl. Ahmad Yani I · South Pontianak',
    statusId: 'Siaga Patroli Ayani - Gajah Mada',
    statusEn: 'Patrolling Ayani - Gajah Mada',
  },
  {
    id: 'cur-3',
    kind: 'courier',
    name: 'Dimas Saputra',
    vehicle: 'Tosa Listrik EV-02',
    plateNumber: 'KB 3042 EC',
    lat: -0.0252,
    lng: 109.3285,
    areaLabelId: 'Melintas Jl. Tanjungpura · Pontianak Kota',
    areaLabelEn: 'Passing Jl. Tanjungpura · Pontianak Kota',
    statusId: 'Siaga Patroli Pontianak Kota',
    statusEn: 'Patrolling Pontianak Kota',
  },
];

export function calculateDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatDistanceLabel(km: number): string {
  if (km < 0.03) return '0 m';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(2)} km`;
}

/**
 * Builds a realistic Pontianak route starting ~1.2-2.0 km away at a major
 * junction/hub, passing through an intermediate road point, and ending at the pickup pin.
 */
export function buildCourierRoute(dest: LocationSelection): {
  waypoints: RoadPoint[];
  collectorHub: CollectorFleetPoint;
} {
  const sortedJunctions = [...PONTIANAK_JUNCTIONS].sort(
    (a, b) =>
      calculateDistanceKm(a.lat, a.lng, dest.lat, dest.lng) -
      calculateDistanceKm(b.lat, b.lng, dest.lat, dest.lng)
  );

  // Pick a starting hub roughly 0.9 - 2.4 km away when available
  const startJunction =
    sortedJunctions.find((j) => {
      const d = calculateDistanceKm(j.lat, j.lng, dest.lat, dest.lng);
      return d >= 0.8 && d <= 2.6;
    }) || sortedJunctions[1] || sortedJunctions[0];

  const nearestJunction = sortedJunctions[0];

  const startPoint: RoadPoint = {
    lat: startJunction.lat,
    lng: startJunction.lng,
    roadNameId: `Pos EcoMove · ${startJunction.roadNameId}`,
    roadNameEn: `EcoMove Hub · ${startJunction.roadNameEn}`,
  };

  const mid1: RoadPoint = {
    lat:
      startJunction.lat * 0.55 +
      nearestJunction.lat * 0.25 +
      dest.lat * 0.2,
    lng:
      startJunction.lng * 0.55 +
      nearestJunction.lng * 0.25 +
      dest.lng * 0.2,
    roadNameId: `Melintas ${startJunction.roadNameId}`,
    roadNameEn: `Passing ${startJunction.roadNameEn}`,
  };

  const mid2: RoadPoint = {
    lat: nearestJunction.lat * 0.45 + dest.lat * 0.55,
    lng: nearestJunction.lng * 0.45 + dest.lng * 0.55,
    roadNameId: `Masuk ${nearestJunction.roadNameId}`,
    roadNameEn: `Entering ${nearestJunction.roadNameEn}`,
  };

  const approachLabelId = dest.gang?.trim()
    ? `Mendekati ${dest.gang.trim()} (${dest.address})`
    : `Mendekati ${dest.address}`;
  const approachLabelEn = dest.gang?.trim()
    ? `Approaching ${dest.gang.trim()} (${dest.address})`
    : `Approaching ${dest.address}`;

  const mid3: RoadPoint = {
    lat: mid2.lat * 0.35 + dest.lat * 0.65,
    lng: mid2.lng * 0.35 + dest.lng * 0.65,
    roadNameId: approachLabelId,
    roadNameEn: approachLabelEn,
  };

  const endPoint: RoadPoint = {
    lat: dest.lat,
    lng: dest.lng,
    roadNameId: dest.address,
    roadNameEn: dest.address,
  };

  // Pick nearest partner collector warehouse
  const collectors = PONTIANAK_COLLECTOR_FLEET.filter((f) => f.kind === 'collector');
  const nearestCollector = [...collectors].sort(
    (a, b) =>
      calculateDistanceKm(a.lat, a.lng, dest.lat, dest.lng) -
      calculateDistanceKm(b.lat, b.lng, dest.lat, dest.lng)
  )[0];

  return {
    waypoints: [startPoint, mid1, mid2, mid3, endPoint],
    collectorHub: nearestCollector,
  };
}

export function calculateRouteLengthKm(waypoints: RoadPoint[]): number {
  let total = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    total += calculateDistanceKm(
      waypoints[i].lat,
      waypoints[i].lng,
      waypoints[i + 1].lat,
      waypoints[i + 1].lng
    );
  }
  return total;
}

export function estimateEtaMinutesFromDistance(
  distanceKm: number,
  isExpress = false
): number {
  // Urban Pontianak Tosa speed ~16-24 km/h including alley turns
  const avgSpeedKmh = isExpress ? 24 : 18;
  const rawMinutes = Math.ceil((distanceKm / avgSpeedKmh) * 60) + (isExpress ? 2 : 4);
  return Math.max(isExpress ? 5 : 8, Math.min(25, rawMinutes));
}

export function getTodayLocalDateStr(nowMs = Date.now()): string {
  const d = new Date(nowMs);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function formatClockHHMM(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function formatClockWIB(ts: number): string {
  return `${formatClockHHMM(ts)} WIB`;
}

export function formatCountdown(
  totalSeconds: number,
  lang: 'id' | 'en',
  compact = false
): string {
  const safeSec = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSec / 3600);
  const mins = Math.floor((safeSec % 3600) / 60);
  const secs = safeSec % 60;
  const secPad = String(secs).padStart(2, '0');

  if (compact) {
    const hUnit = lang === 'id' ? 'j' : 'h';
    const mUnit = 'm';
    const sUnit = lang === 'id' ? 'd' : 's';
    if (hours > 0) return `${hours}${hUnit} ${mins}${mUnit} ${secPad}${sUnit}`;
    return `${mins}${mUnit} ${secPad}${sUnit}`;
  }

  if (lang === 'id') {
    if (hours > 0) return `${hours} jam ${mins} mnt ${secPad} dtk`;
    return `${mins} menit ${secPad} detik`;
  }
  if (hours > 0) return `${hours} hr ${mins} min ${secPad} sec`;
  return `${mins} min ${secPad} sec`;
}

export function parseScheduleTimestamp(
  scheduleDate?: string,
  scheduleTime?: string
): number | null {
  if (!scheduleTime) return null;
  const timeMatch = scheduleTime.match(/(\d{1,2}):(\d{2})/);
  if (!timeMatch) return null;

  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (Number.isNaN(hour) || Number.isNaN(minute) || hour > 23 || minute > 59) {
    return null;
  }

  const baseDate = scheduleDate && /^\d{4}-\d{2}-\d{2}$/.test(scheduleDate)
    ? scheduleDate
    : getTodayLocalDateStr();
  const [y, m, d] = baseDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d, hour, minute, 0, 0);
  return dt.getTime();
}

export interface SyncedPickupEtaResult {
  routeKm: number;
  routeEtaMinutes: number;
  minArrivalTimestamp: number;
  scheduledTimestamp: number | null;
  etaTargetTimestamp: number;
  etaMinutesTotal: number;
  isAdjustedToFastest: boolean;
}

export function computeSyncedPickupEta(params: {
  location: LocationSelection;
  isExpress: boolean;
  scheduleStartDate?: string;
  scheduleTime?: string;
  nowMs?: number;
}): SyncedPickupEtaResult {
  const {
    location,
    isExpress,
    scheduleStartDate,
    scheduleTime,
    nowMs = Date.now(),
  } = params;

  const { waypoints } = buildCourierRoute(location);
  const routeKm = calculateRouteLengthKm(waypoints);
  const routeEtaMinutes = estimateEtaMinutesFromDistance(routeKm, isExpress);
  const minArrivalTimestamp = nowMs + routeEtaMinutes * 60 * 1000 + 30 * 1000;
  const scheduledTimestamp = parseScheduleTimestamp(scheduleStartDate, scheduleTime);

  const isScheduledReachable =
    scheduledTimestamp !== null && scheduledTimestamp >= minArrivalTimestamp - 60_000;

  const etaTargetTimestamp = isScheduledReachable
    ? Math.max(minArrivalTimestamp, scheduledTimestamp!)
    : minArrivalTimestamp;

  const isAdjustedToFastest =
    scheduledTimestamp !== null && scheduledTimestamp < minArrivalTimestamp - 60_000;

  const etaMinutesTotal = Math.max(
    routeEtaMinutes,
    Math.ceil((etaTargetTimestamp - nowMs) / 60_000)
  );

  return {
    routeKm,
    routeEtaMinutes,
    minArrivalTimestamp,
    scheduledTimestamp,
    etaTargetTimestamp,
    etaMinutesTotal,
    isAdjustedToFastest,
  };
}

export interface LiveCourierSnapshot {
  lat: number;
  lng: number;
  roadNameId: string;
  roadNameEn: string;
  speedKmh: number;
  remainingKm: number;
  etaMinutes: number;
  etaRemainingSeconds: number;
  targetTimestamp: number;
  progressPct: number;
}

/**
 * Computes interpolated live courier / collector position strictly synchronized
 * with the Estimasi Tiba countdown (etaTargetTimestamp & collectorEtaTimestamp).
 */
export function interpolateCourierPosition(params: {
  waypoints: RoadPoint[];
  collectorHub: CollectorFleetPoint;
  status: OrderStatus;
  nowMs: number;
  etaMinutesInitial: number;
  etaTargetTimestamp: number;
  collectorEtaMinutesInitial?: number;
  collectorEtaTimestamp?: number;
}): LiveCourierSnapshot {
  const {
    waypoints,
    collectorHub,
    status,
    nowMs,
    etaMinutesInitial,
    etaTargetTimestamp,
    collectorEtaMinutesInitial = 12,
    collectorEtaTimestamp,
  } = params;

  const dest = waypoints[waypoints.length - 1];
  const totalRouteKm = Math.max(0.4, calculateRouteLengthKm(waypoints));

  if (status === 'searching') {
    const start = waypoints[0];
    const remainingMs = Math.max(0, etaTargetTimestamp - nowMs);
    const remainingSec = Math.ceil(remainingMs / 1000);
    return {
      lat: start.lat,
      lng: start.lng,
      roadNameId: start.roadNameId,
      roadNameEn: start.roadNameEn,
      speedKmh: 0,
      remainingKm: totalRouteKm,
      etaMinutes: Math.max(1, Math.ceil(remainingSec / 60)),
      etaRemainingSeconds: remainingSec,
      targetTimestamp: etaTargetTimestamp,
      progressPct: 0,
    };
  }

  if (status === 'arrived') {
    return {
      lat: dest.lat,
      lng: dest.lng,
      roadNameId: dest.roadNameId,
      roadNameEn: dest.roadNameEn,
      speedKmh: 0,
      remainingKm: 0,
      etaMinutes: 0,
      etaRemainingSeconds: 0,
      targetTimestamp: etaTargetTimestamp,
      progressPct: 100,
    };
  }

  if (status === 'completed') {
    const targetColTs =
      collectorEtaTimestamp ?? nowMs + collectorEtaMinutesInitial * 60 * 1000;
    const totalColMs = Math.max(60_000, collectorEtaMinutesInitial * 60 * 1000);
    const remainingColMs = Math.max(0, targetColTs - nowMs);
    const colProgress = Math.min(1, Math.max(0.04, 1 - remainingColMs / totalColMs));

    const lat = dest.lat + (collectorHub.lat - dest.lat) * colProgress;
    const lng = dest.lng + (collectorHub.lng - dest.lng) * colProgress;
    const kmToWarehouse = calculateDistanceKm(
      lat,
      lng,
      collectorHub.lat,
      collectorHub.lng
    );
    const remainingSec = Math.ceil(remainingColMs / 1000);
    const hoursLeft = Math.max(0.01, remainingColMs / 3_600_000);
    const syncedSpeed =
      remainingColMs <= 0
        ? 0
        : Math.max(18, Math.min(34, Math.round(kmToWarehouse / hoursLeft)));

    return {
      lat,
      lng,
      roadNameId:
        remainingColMs <= 0
          ? `Tiba di ${collectorHub.name}`
          : `Menuju ${collectorHub.name}`,
      roadNameEn:
        remainingColMs <= 0
          ? `Arrived at ${collectorHub.name}`
          : `Heading to ${collectorHub.name}`,
      speedKmh: syncedSpeed,
      remainingKm: remainingColMs <= 0 ? 0 : kmToWarehouse,
      etaMinutes: Math.ceil(remainingSec / 60),
      etaRemainingSeconds: remainingSec,
      targetTimestamp: targetColTs,
      progressPct: Math.round(colProgress * 100),
    };
  }

  // status === 'enroute': strictly locked to etaTargetTimestamp
  const totalEtaMs = Math.max(60_000, etaMinutesInitial * 60 * 1000 + 30_000);
  const remainingMs = Math.max(0, etaTargetTimestamp - nowMs);
  const remainingSec = Math.ceil(remainingMs / 1000);
  const progress = Math.min(1, Math.max(0.02, 1 - remainingMs / totalEtaMs));

  const totalSegs = waypoints.length - 1;
  const scaled = Math.min(0.999, progress) * totalSegs;
  const segIndex = Math.min(totalSegs - 1, Math.floor(scaled));
  const segT = scaled - segIndex;
  const a = waypoints[segIndex];
  const b = waypoints[segIndex + 1];

  const lat = a.lat + (b.lat - a.lat) * segT;
  const lng = a.lng + (b.lng - a.lng) * segT;
  const remainingKm = Math.max(0, totalRouteKm * (1 - progress));
  const hoursLeft = Math.max(0.01, remainingMs / 3_600_000);
  const computedSpeed = Math.round(remainingKm / hoursLeft);
  const speedKmh =
    remainingMs <= 0 ? 0 : Math.max(14, Math.min(32, computedSpeed || 20));

  return {
    lat,
    lng,
    roadNameId: b.roadNameId,
    roadNameEn: b.roadNameEn,
    speedKmh,
    remainingKm,
    etaMinutes: Math.ceil(remainingSec / 60),
    etaRemainingSeconds: remainingSec,
    targetTimestamp: etaTargetTimestamp,
    progressPct: Math.round(progress * 100),
  };
}
