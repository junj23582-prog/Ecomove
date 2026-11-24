import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Building2,
  Compass,
  Layers,
  LocateFixed,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Minus,
  Navigation,
  Plus,
  Radio,
  Route,
  Truck,
} from 'lucide-react';
import type { Language, LocationSelection, PickupOrder } from '../types/ecomove';
import { getT } from '../i18n/translations';
import {
  buildCourierRoute,
  calculateDistanceKm,
  estimateEtaMinutesFromDistance,
  formatClockWIB,
  formatCountdown,
  formatDistanceLabel,
  interpolateCourierPosition,
  PONTIANAK_COLLECTOR_FLEET,
  type CollectorFleetPoint,
} from '../utils/trackingSimulation';

interface LiveTrackingMapProps {
  lang: Language;
  activeOrder: PickupOrder | null;
  userLocation: LocationSelection;
  nowMs: number;
  onFocusOrderForm?: () => void;
}

const USER_PIN_HTML = `
  <div style="position:relative;width:30px;height:38px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.45));">
    <svg width="30" height="38" viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 2C9.71573 2 3 8.71573 3 17C3 27.5 18 42 18 42C18 42 33 27.5 33 17C33 8.71573 26.2843 2 18 2Z" fill="#059669" stroke="#FFFFFF" stroke-width="2.5"/>
      <circle cx="18" cy="17" r="5.5" fill="#FFFFFF"/>
    </svg>
  </div>
`;

function createCourierMarkerHtml(label: string, isLiveMoving: boolean): string {
  const pulseRing = isLiveMoving
    ? `<span style="position:absolute;inset:-4px;border-radius:9999px;background:rgba(16,185,129,0.35);animation:ping 1.6s cubic-bezier(0,0,0.2,1) infinite;"></span>`
    : '';
  return `
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
      <div style="position:relative;width:36px;height:36px;border-radius:9999px;background:#0F172A;border:2.5px solid #10B981;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(15,23,42,0.35);">
        ${pulseRing}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34D399" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="position:relative;z-index:1;">
          <path d="M10 17h4V5H2v12h3"/>
          <path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5"/>
          <circle cx="7.5" cy="17.5" r="2.5"/>
          <circle cx="17.5" cy="17.5" r="2.5"/>
        </svg>
      </div>
      <span style="margin-top:2px;padding:1px 6px;border-radius:6px;background:#0F172A;color:#ECFDF5;font-size:9px;font-weight:700;white-space:nowrap;box-shadow:0 2px 4px rgba(0,0,0,0.25);border:1px solid rgba(52,211,153,0.45);">
        ${label}
      </span>
    </div>
  `;
}

function createCollectorMarkerHtml(label: string): string {
  return `
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
      <div style="width:32px;height:32px;border-radius:10px;background:#D97706;border:2px solid #FFFFFF;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(180,83,9,0.35);">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 21h18"/>
          <path d="M5 21V7l7-4 7 4v14"/>
          <path d="M9 21v-6h6v6"/>
        </svg>
      </div>
      <span style="margin-top:2px;padding:1px 5px;border-radius:6px;background:#92400E;color:#FEF3C7;font-size:9px;font-weight:700;white-space:nowrap;box-shadow:0 2px 4px rgba(0,0,0,0.25);">
        ${label}
      </span>
    </div>
  `;
}

export function LiveTrackingMap({
  lang,
  activeOrder,
  userLocation,
  nowMs,
  onFocusOrderForm,
}: LiveTrackingMapProps) {
  const t = getT(lang);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const esriSatelliteRef = useRef<L.TileLayer | null>(null);
  const hybridLabelsRef = useRef<L.TileLayer | null>(null);
  const streetLayerRef = useRef<L.TileLayer | null>(null);

  const userMarkerRef = useRef<L.Marker | null>(null);
  const courierMarkerRef = useRef<L.Marker | null>(null);
  const collectorMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const radarMarkersRef = useRef<Map<string, L.Marker>>(new Map());

  const [mapMode, setMapMode] = useState<'satellite' | 'street'>('street');
  const [isExpanded, setIsExpanded] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(15);
  const [selectedFleetId, setSelectedFleetId] = useState<string>('cur-1');

  // Subtle 1s counter used only for idle fleet patrol motion
  const tickCount = Math.floor(nowMs / 1000);
  const orderId = activeOrder?.id ?? null;

  const activeRoute = useMemo(() => {
    const targetLoc = activeOrder ? activeOrder.location : userLocation;
    return buildCourierRoute(targetLoc);
  }, [activeOrder, userLocation]);

  const liveCourierState = useMemo(() => {
    if (!activeOrder) return null;
    return interpolateCourierPosition({
      waypoints: activeRoute.waypoints,
      collectorHub: activeRoute.collectorHub,
      status: activeOrder.status,
      nowMs,
      etaMinutesInitial: activeOrder.etaMinutesInitial,
      etaTargetTimestamp: activeOrder.etaTargetTimestamp,
      collectorEtaMinutesInitial: activeOrder.collectorEtaMinutesInitial,
      collectorEtaTimestamp: activeOrder.collectorEtaTimestamp,
    });
  }, [activeOrder, activeRoute, nowMs]);

  // Live patrolling fleet positions (when no activeOrder) with real distance-based ETA
  const liveFleetList = useMemo(() => {
    const target = userLocation;
    return PONTIANAK_COLLECTOR_FLEET.map((unit, idx) => {
      const driftLat =
        unit.kind === 'courier'
          ? Math.sin(tickCount * 0.14 + idx * 1.7) * 0.0009
          : 0;
      const driftLng =
        unit.kind === 'courier'
          ? Math.cos(tickCount * 0.12 + idx * 2.1) * 0.0009
          : 0;
      const lat = unit.lat + driftLat;
      const lng = unit.lng + driftLng;
      const distKm = calculateDistanceKm(lat, lng, target.lat, target.lng);
      const etaMin = estimateEtaMinutesFromDistance(distKm, false);
      return {
        ...unit,
        lat,
        lng,
        distKm,
        etaMin,
      };
    }).sort((a, b) => a.distKm - b.distKm);
  }, [tickCount, userLocation]);

  // Initialize Leaflet map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialTarget = activeOrder ? activeOrder.location : userLocation;
    const map = L.map(mapContainerRef.current, {
      center: [initialTarget.lat, initialTarget.lng],
      zoom: 15,
      minZoom: 5,
      maxZoom: 20,
      zoomControl: false,
      fadeAnimation: false,
    });

    const esriImagery = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Imagery &copy; Esri',
        minZoom: 5,
        maxNativeZoom: 19,
        maxZoom: 20,
        keepBuffer: 4,
        updateWhenIdle: false,
        zIndex: 1,
      }
    );

    const hybridLabels = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png',
      {
        attribution: '&copy; CARTO',
        subdomains: 'abcd',
        minZoom: 5,
        maxNativeZoom: 18,
        maxZoom: 20,
        keepBuffer: 4,
        updateWhenIdle: false,
        zIndex: 2,
      }
    );

    const streetLayer = L.tileLayer(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: '&copy; OpenStreetMap',
        minZoom: 5,
        maxNativeZoom: 19,
        maxZoom: 20,
        keepBuffer: 4,
        updateWhenIdle: false,
        zIndex: 1,
      }
    );

    streetLayer.addTo(map);
    esriSatelliteRef.current = esriImagery;
    hybridLabelsRef.current = hybridLabels;
    streetLayerRef.current = streetLayer;

    map.on('zoomend', () => {
      setZoomLevel(map.getZoom());
    });

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const resizeObserver = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        map.invalidateSize({ animate: false, pan: false });
      }, 40);
    });
    resizeObserver.observe(mapContainerRef.current);

    mapInstanceRef.current = map;

    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
      esriSatelliteRef.current = null;
      hybridLabelsRef.current = null;
      streetLayerRef.current = null;
      userMarkerRef.current = null;
      courierMarkerRef.current = null;
      collectorMarkerRef.current = null;
      routeLineRef.current = null;
      radarMarkersRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch Satellite vs Street cleanly
  useEffect(() => {
    const map = mapInstanceRef.current;
    const sat = esriSatelliteRef.current;
    const labels = hybridLabelsRef.current;
    const street = streetLayerRef.current;
    if (!map || !sat || !labels || !street) return;

    if (mapMode === 'satellite') {
      if (map.hasLayer(street)) map.removeLayer(street);
      if (!map.hasLayer(sat)) sat.addTo(map);
      if (!map.hasLayer(labels)) labels.addTo(map);
    } else {
      if (map.hasLayer(sat)) map.removeLayer(sat);
      if (map.hasLayer(labels)) map.removeLayer(labels);
      if (!map.hasLayer(street)) street.addTo(map);
    }
    map.invalidateSize({ animate: false, pan: false });
  }, [mapMode]);

  // Sync map bounds when Perbesar / Perkecil changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const frameId = requestAnimationFrame(() => {
      map.invalidateSize({ animate: false, pan: false });
    });
    const timerId = setTimeout(() => {
      map.invalidateSize({ animate: false, pan: false });
    }, 80);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timerId);
    };
  }, [isExpanded]);

  // Sync Markers & Route Polyline without tearing down the map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const targetLoc = activeOrder ? activeOrder.location : userLocation;

    // 1. User Pickup Pin
    if (!userMarkerRef.current) {
      userMarkerRef.current = L.marker([targetLoc.lat, targetLoc.lng], {
        icon: L.divIcon({
          className: 'ecomove-user-pin',
          html: USER_PIN_HTML,
          iconSize: [30, 38],
          iconAnchor: [15, 38],
        }),
      }).addTo(map);
    } else {
      userMarkerRef.current.setLatLng([targetLoc.lat, targetLoc.lng]);
    }

    if (activeOrder && liveCourierState) {
      // Remove fleet radar markers when tracking a specific active order
      radarMarkersRef.current.forEach((m) => map.removeLayer(m));
      radarMarkersRef.current.clear();

      const courierLabel = `${activeOrder.courier.name.split(' ')[0]} · ${activeOrder.courier.plateNumber}`;
      const isMoving =
        activeOrder.status === 'enroute' || activeOrder.status === 'completed';

      // 2. Active Courier Tosa Marker
      if (!courierMarkerRef.current) {
        courierMarkerRef.current = L.marker(
          [liveCourierState.lat, liveCourierState.lng],
          {
            icon: L.divIcon({
              className: 'ecomove-courier-pin',
              html: createCourierMarkerHtml(courierLabel, isMoving),
              iconSize: [120, 56],
              iconAnchor: [60, 18],
            }),
            zIndexOffset: 500,
          }
        ).addTo(map);
      } else {
        courierMarkerRef.current.setLatLng([
          liveCourierState.lat,
          liveCourierState.lng,
        ]);
        courierMarkerRef.current.setIcon(
          L.divIcon({
            className: 'ecomove-courier-pin',
            html: createCourierMarkerHtml(courierLabel, isMoving),
            iconSize: [120, 56],
            iconAnchor: [60, 18],
          })
        );
      }

      // 3. Nearest Collector Warehouse Marker
      const col = activeRoute.collectorHub;
      const colShortLabel =
        lang === 'id' ? 'Pengepul Mitra' : 'Partner Collector';
      if (!collectorMarkerRef.current) {
        collectorMarkerRef.current = L.marker([col.lat, col.lng], {
          icon: L.divIcon({
            className: 'ecomove-collector-pin',
            html: createCollectorMarkerHtml(colShortLabel),
            iconSize: [110, 52],
            iconAnchor: [55, 16],
          }),
          zIndexOffset: 300,
        }).addTo(map);
      } else {
        collectorMarkerRef.current.setLatLng([col.lat, col.lng]);
      }

      // 4. Route Polyline
      const lineCoords: L.LatLngExpression[] =
        activeOrder.status === 'completed'
          ? [
              [liveCourierState.lat, liveCourierState.lng],
              [col.lat, col.lng],
            ]
          : [
              [liveCourierState.lat, liveCourierState.lng],
              [targetLoc.lat, targetLoc.lng],
            ];

      if (!routeLineRef.current) {
        routeLineRef.current = L.polyline(lineCoords, {
          color: activeOrder.status === 'completed' ? '#D97706' : '#059669',
          weight: 4,
          opacity: 0.85,
          dashArray: '8 6',
        }).addTo(map);
      } else {
        routeLineRef.current.setLatLngs(lineCoords);
        routeLineRef.current.setStyle({
          color: activeOrder.status === 'completed' ? '#D97706' : '#059669',
        });
      }
    } else {
      // Fleet Radar Mode (No active order yet)
      if (courierMarkerRef.current) {
        map.removeLayer(courierMarkerRef.current);
        courierMarkerRef.current = null;
      }
      if (collectorMarkerRef.current) {
        map.removeLayer(collectorMarkerRef.current);
        collectorMarkerRef.current = null;
      }
      if (routeLineRef.current) {
        map.removeLayer(routeLineRef.current);
        routeLineRef.current = null;
      }

      liveFleetList.forEach((unit) => {
        const existing = radarMarkersRef.current.get(unit.id);
        const iconHtml =
          unit.kind === 'courier'
            ? createCourierMarkerHtml(unit.name.split(' ')[0], true)
            : createCollectorMarkerHtml(
                lang === 'id' ? 'Pengepul' : 'Collector'
              );
        const divIcon = L.divIcon({
          className: `ecomove-fleet-${unit.id}`,
          html: iconHtml,
          iconSize: [100, 52],
          iconAnchor: [50, 18],
        });

        if (!existing) {
          const marker = L.marker([unit.lat, unit.lng], {
            icon: divIcon,
            zIndexOffset: unit.kind === 'courier' ? 400 : 250,
          }).addTo(map);
          marker.on('click', () => {
            setSelectedFleetId(unit.id);
            map.setView([unit.lat, unit.lng], Math.max(map.getZoom(), 15), {
              animate: true,
            });
          });
          radarMarkersRef.current.set(unit.id, marker);
        } else {
          existing.setLatLng([unit.lat, unit.lng]);
        }
      });
    }
  }, [activeOrder, activeRoute, liveCourierState, liveFleetList, userLocation, lang]);

  // Fit bounds when order first activates
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (activeOrder && liveCourierState) {
      const bounds = L.latLngBounds([
        [liveCourierState.lat, liveCourierState.lng],
        [activeOrder.location.lat, activeOrder.location.lng],
      ]);
      map.fitBounds(bounds, { padding: [44, 44], maxZoom: 16, animate: false });
    } else if (!activeOrder) {
      map.setView([userLocation.lat, userLocation.lng], 14, { animate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const handleFocusCourier = () => {
    if (!mapInstanceRef.current || !liveCourierState) return;
    mapInstanceRef.current.setView(
      [liveCourierState.lat, liveCourierState.lng],
      17,
      { animate: true }
    );
  };

  const handleFocusRoute = () => {
    if (!mapInstanceRef.current || !activeOrder || !liveCourierState) return;
    const bounds = L.latLngBounds([
      [liveCourierState.lat, liveCourierState.lng],
      [activeOrder.location.lat, activeOrder.location.lng],
    ]);
    if (activeOrder.status === 'completed') {
      bounds.extend([activeRoute.collectorHub.lat, activeRoute.collectorHub.lng]);
    }
    mapInstanceRef.current.fitBounds(bounds, {
      padding: [42, 42],
      maxZoom: 17,
      animate: true,
    });
  };

  const handleFocusCollector = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setView(
      [activeRoute.collectorHub.lat, activeRoute.collectorHub.lng],
      16,
      { animate: true }
    );
  };

  const handleSelectFleetUnit = (unit: CollectorFleetPoint & { distKm: number }) => {
    setSelectedFleetId(unit.id);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([unit.lat, unit.lng], 16, { animate: true });
    }
  };

  const statusStageText = activeOrder
    ? activeOrder.status === 'searching'
      ? t.courierStageSearching
      : activeOrder.status === 'enroute'
      ? t.courierStageEnroute
      : activeOrder.status === 'arrived'
      ? t.courierStageArrived
      : t.courierStageCompleted
    : '';

  return (
    <section className="bg-white rounded-2xl border border-[#A7F3D0] p-3.5 space-y-3 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Radio className="w-4 h-4 text-[#059669] shrink-0 animate-pulse" />
          <div className="min-w-0">
            <h3 className="font-display text-xs font-bold text-[#0F172A] truncate">
              {activeOrder ? t.liveMapTitle : t.radarTitle}
            </h3>
            <p className="text-[10px] text-[#059669] font-semibold truncate">
              Pontianak, Kalimantan Barat
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#ECFDF5] border border-[#A7F3D0] text-[10px] font-bold text-[#059669] shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-ping" />
          <span>{t.liveGpsActive}</span>
        </span>
      </div>

      {/* Map Viewport */}
      <div className="relative rounded-xl overflow-hidden border border-[#CBD5E1] bg-[#E2E8F0]">
        <div
          ref={mapContainerRef}
          style={{ height: isExpanded ? 380 : 230 }}
          className="w-full"
          aria-label="Peta Deteksi Lokasi Kurir dan Pengepul EcoMove Pontianak"
        />

        {/* Top-Left Layer Switch: Satelit / Peta Jalan */}
        <div className="absolute top-2.5 left-2.5 z-[400] inline-flex rounded-xl bg-white/95 backdrop-blur-xs p-0.5 border border-[#CBD5E1] shadow-md">
          <button
            type="button"
            onClick={() => setMapMode('satellite')}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer whitespace-nowrap ${
              mapMode === 'satellite'
                ? 'bg-[#059669] text-white shadow-xs'
                : 'text-[#334155]'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>{lang === 'id' ? 'Satelit' : 'Satellite'}</span>
          </button>
          <button
            type="button"
            onClick={() => setMapMode('street')}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer whitespace-nowrap ${
              mapMode === 'street'
                ? 'bg-[#059669] text-white shadow-xs'
                : 'text-[#334155]'
            }`}
          >
            <MapIcon className="w-3 h-3" />
            <span>{t.mapLayerStreet}</span>
          </button>
        </div>

        {/* Top-Right Perbesar/Perkecil + Zoom Controls */}
        <div className="absolute top-2.5 right-2.5 z-[400] flex flex-col items-end gap-1.5">
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-xl bg-white/95 backdrop-blur-xs border border-[#CBD5E1] text-[10px] font-bold text-[#0F172A] shadow-md cursor-pointer whitespace-nowrap"
          >
            {isExpanded ? (
              <Minimize2 className="w-3 h-3 text-[#059669]" />
            ) : (
              <Maximize2 className="w-3 h-3 text-[#059669]" />
            )}
            <span>{isExpanded ? t.mapCollapseBtn : t.mapExpandBtn}</span>
          </button>

          <div className="flex flex-col rounded-xl bg-white/95 backdrop-blur-xs border border-[#CBD5E1] shadow-md overflow-hidden">
            <button
              type="button"
              onClick={() => mapInstanceRef.current?.zoomIn()}
              aria-label="Zoom in"
              className="w-8 h-8 flex items-center justify-center text-[#0F172A] hover:bg-[#ECFDF5] border-b border-[#E2E8F0] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
            <div className="px-1 py-0.5 text-center font-mono-tabular text-[9px] font-bold text-[#059669] bg-[#F8FAFC] border-b border-[#E2E8F0]">
              {zoomLevel}x
            </div>
            <button
              type="button"
              onClick={() => mapInstanceRef.current?.zoomOut()}
              aria-label="Zoom out"
              className="w-8 h-8 flex items-center justify-center text-[#0F172A] hover:bg-[#ECFDF5] cursor-pointer"
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Bottom-Left Quick Focus Buttons */}
        {activeOrder ? (
          <div className="absolute bottom-2.5 left-2.5 z-[400] flex items-center gap-1">
            <button
              type="button"
              onClick={handleFocusCourier}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#0F172A]/90 text-[#34D399] text-[10px] font-bold shadow-sm cursor-pointer whitespace-nowrap"
            >
              <LocateFixed className="w-3 h-3" />
              <span>{t.focusCourierBtn}</span>
            </button>
            <button
              type="button"
              onClick={handleFocusRoute}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/95 text-[#059669] border border-[#CBD5E1] text-[10px] font-bold shadow-sm cursor-pointer whitespace-nowrap"
            >
              <Route className="w-3 h-3" />
              <span>{t.focusRouteBtn}</span>
            </button>
            <button
              type="button"
              onClick={handleFocusCollector}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#92400E]/90 text-[#FEF3C7] text-[10px] font-bold shadow-sm cursor-pointer whitespace-nowrap"
            >
              <Building2 className="w-3 h-3" />
              <span>{t.focusCollectorBtn}</span>
            </button>
          </div>
        ) : (
          <div className="absolute bottom-2.5 left-2.5 z-[400] flex items-center gap-1">
            <button
              type="button"
              onClick={() =>
                mapInstanceRef.current?.setView(
                  [userLocation.lat, userLocation.lng],
                  15,
                  { animate: true }
                )
              }
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/95 text-[#059669] border border-[#CBD5E1] text-[10px] font-bold shadow-sm cursor-pointer whitespace-nowrap"
            >
              <Compass className="w-3 h-3" />
              <span>{lang === 'id' ? 'Titik Saya' : 'My Pin'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Live Telemetry Info Synced with Estimasi Tiba */}
      {activeOrder && liveCourierState ? (
        <div className="p-3 rounded-xl bg-[#F4F9F6] border border-[#D1FAE5] space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#059669]">
                {t.courierPositionLabel}
              </p>
              <p className="text-xs font-bold text-[#0F172A] leading-snug mt-0.5">
                {lang === 'id'
                  ? liveCourierState.roadNameId
                  : liveCourierState.roadNameEn}
              </p>
              <p className="text-[11px] text-[#64748B] mt-0.5">{statusStageText}</p>
            </div>
            <div className="text-right shrink-0">
              <span className="font-mono-tabular text-[10px] font-bold px-2 py-1 rounded-lg bg-white border border-[#A7F3D0] text-[#059669] block">
                {formatDistanceLabel(liveCourierState.remainingKm)}
              </span>
              <span className="font-mono-tabular text-[10px] font-bold text-[#0F172A] mt-1 block">
                {liveCourierState.etaRemainingSeconds > 0
                  ? formatCountdown(liveCourierState.etaRemainingSeconds, lang, true)
                  : t.arrivedOnTime}
              </span>
            </div>
          </div>

          {/* ETA-Synced Journey Progress Bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] gap-2">
              <span className="font-semibold text-[#059669] truncate">
                {t.etaSyncedTripLabel} ({liveCourierState.progressPct}%)
              </span>
              <span className="font-mono-tabular font-bold text-[#0F172A] shrink-0">
                {activeOrder.status === 'completed' ? t.collectorEtaLabel : t.etaLabel}:{' '}
                {formatClockWIB(liveCourierState.targetTimestamp)}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-[#E2E8F0] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  activeOrder.status === 'completed' ? 'bg-[#D97706]' : 'bg-[#059669]'
                }`}
                style={{ width: `${liveCourierState.progressPct}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-[#D1FAE5] text-[10px]">
            <div className="bg-white rounded-lg p-1.5 border border-[#E2E8F0]">
              <p className="text-[#64748B]">{t.distanceLabel}</p>
              <p className="font-mono-tabular font-bold text-[#0F172A]">
                {formatDistanceLabel(liveCourierState.remainingKm)}
              </p>
            </div>
            <div className="bg-white rounded-lg p-1.5 border border-[#E2E8F0]">
              <p className="text-[#64748B]">{t.speedLabel}</p>
              <p className="font-mono-tabular font-bold text-[#059669]">
                {liveCourierState.speedKmh} km/j
              </p>
            </div>
            <div className="bg-white rounded-lg p-1.5 border border-[#E2E8F0]">
              <p className="text-[#64748B]">GPS</p>
              <p className="font-mono-tabular font-bold text-[#0F172A] truncate">
                {liveCourierState.lat.toFixed(4)}, {liveCourierState.lng.toFixed(3)}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 text-[10px] text-[#92400E] bg-[#FEF3C7]/70 border border-[#FDE68A] rounded-lg px-2.5 py-1.5">
            <span className="flex items-center gap-1 font-semibold truncate">
              <Building2 className="w-3 h-3 shrink-0 text-[#D97706]" />
              <span className="truncate">
                {t.collectorHubLabel}: {activeRoute.collectorHub.name}
              </span>
            </span>
            <span className="font-mono-tabular font-bold shrink-0">
              {activeOrder.status === 'completed'
                ? `${t.collectorEtaLabel} ${formatClockWIB(liveCourierState.targetTimestamp)}`
                : activeRoute.collectorHub.plateNumber}
            </span>
          </div>
        </div>
      ) : (
        /* Fleet Radar List (When no active order) */
        <div className="space-y-2">
          <p className="text-[11px] text-[#64748B] leading-snug">
            {t.radarSubtitle}
          </p>
          <div className="space-y-1.5">
            {liveFleetList.map((unit) => {
              const selected = selectedFleetId === unit.id;
              return (
                <button
                  key={unit.id}
                  type="button"
                  onClick={() => handleSelectFleetUnit(unit)}
                  className={`w-full text-left p-2.5 rounded-xl border transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                    selected
                      ? 'bg-[#ECFDF5] border-[#10B981]'
                      : 'bg-[#F8FAFC] border-[#E2E8F0] hover:border-[#A7F3D0]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        unit.kind === 'courier'
                          ? 'bg-[#0F172A] text-[#34D399]'
                          : 'bg-[#D97706] text-white'
                      }`}
                    >
                      {unit.kind === 'courier' ? (
                        <Truck className="w-4 h-4" />
                      ) : (
                        <Building2 className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-[#0F172A] truncate">
                          {unit.name}
                        </p>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                            unit.kind === 'courier'
                              ? 'bg-[#D1FAE5] text-[#065F46]'
                              : 'bg-[#FEF3C7] text-[#92400E]'
                          }`}
                        >
                          {unit.kind === 'courier'
                            ? lang === 'id'
                              ? 'Kurir Tosa'
                              : 'Courier'
                            : lang === 'id'
                            ? 'Pengepul'
                            : 'Collector'}
                        </span>
                      </div>
                      <p className="text-[10px] font-semibold text-[#059669] truncate">
                        {lang === 'id' ? unit.areaLabelId : unit.areaLabelEn}
                      </p>
                      <p className="text-[10px] text-[#64748B] truncate">
                        {unit.plateNumber} ·{' '}
                        {lang === 'id' ? unit.statusId : unit.statusEn}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono-tabular text-[11px] font-bold text-[#0F172A] block">
                      {formatDistanceLabel(unit.distKm)}
                    </span>
                    <span className="font-mono-tabular text-[10px] font-bold text-[#059669] block">
                      {t.radarEtaPrefix} ~{unit.etaMin} {t.minutesShort}
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-[9px] text-[#64748B] font-semibold">
                      <Navigation className="w-2.5 h-2.5 text-[#059669]" />
                      {lang === 'id' ? 'Pantau' : 'Track'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {onFocusOrderForm && (
            <button
              type="button"
              onClick={onFocusOrderForm}
              className="w-full min-h-[40px] rounded-xl bg-[#059669] text-white text-xs font-bold cursor-pointer mt-1"
            >
              {t.orderNowBtn}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
