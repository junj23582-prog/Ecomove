import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Building,
  Crosshair,
  Home,
  Layers,
  Loader2,
  Map as MapIcon,
  MapPin,
  Maximize2,
  Minimize2,
  Minus,
  Navigation2,
  Plus,
  Search,
  ZoomIn,
} from 'lucide-react';
import type { Language, LocationAreaType, LocationSelection } from '../types/ecomove';
import {
  formatLocationDetail,
  PONTIANAK_SUBAREA_PRESETS,
  PRESET_LOCATIONS,
  RT_OPTIONS,
  RW_OPTIONS,
  type PontianakSubAreaPreset,
} from '../data/mockData';
import { getT } from '../i18n/translations';

interface InteractiveMapProps {
  lang: Language;
  value: LocationSelection;
  onChange: (next: LocationSelection) => void;
}

interface NominatimResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    road?: string;
    suburb?: string;
    city_district?: string;
    city?: string;
    state?: string;
  };
}

// Pontianak, Kalimantan Barat bounding box
const PONTIANAK_CENTER: [number, number] = [-0.0472, 109.3426];
const PONTIANAK_VIEWBOX = '109.25,0.06,109.42,-0.12';

const PIN_HTML = `
  <div style="position:relative;width:32px;height:40px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.45));">
    <svg width="32" height="40" viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 2C9.71573 2 3 8.71573 3 17C3 27.5 18 42 18 42C18 42 33 27.5 33 17C33 8.71573 26.2843 2 18 2Z" fill="#059669" stroke="#FFFFFF" stroke-width="2.5"/>
      <circle cx="18" cy="17" r="6" fill="#FFFFFF"/>
    </svg>
  </div>
`;

function nearestPontianakFallback(
  lat: number,
  lng: number
): { address: string; district: string } {
  let closest = PRESET_LOCATIONS[0];
  let bestDist = Infinity;
  for (const loc of PRESET_LOCATIONS) {
    const d = Math.hypot(loc.lat - lat, loc.lng - lng);
    if (d < bestDist) {
      bestDist = d;
      closest = loc;
    }
  }
  if (bestDist < 0.004) {
    return { address: closest.address, district: closest.district };
  }
  return {
    address: `Titik Jemput Pontianak (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
    district: closest.district,
  };
}

function isInsideKalbar(lat: number, lng: number): boolean {
  return lat >= -3.1 && lat <= 2.1 && lng >= 108.5 && lng <= 114.2;
}

export function InteractiveMap({ lang, value, onChange }: InteractiveMapProps) {
  const t = getT(lang);
  const mapWrapperRef = useRef<HTMLDivElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const esriSatelliteRef = useRef<L.TileLayer | null>(null);
  const hybridLabelsRef = useRef<L.TileLayer | null>(null);
  const streetLayerRef = useRef<L.TileLayer | null>(null);
  const latestValueRef = useRef<LocationSelection>(value);
  latestValueRef.current = value;

  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [osmResults, setOsmResults] = useState<LocationSelection[]>([]);
  const [searchingOsm, setSearchingOsm] = useState(false);
  const [locating, setLocating] = useState(false);

  const [mapMode, setMapMode] = useState<'satellite' | 'street'>('satellite');
  const [zoomLevel, setZoomLevel] = useState<number>(17);
  const [isExpanded, setIsExpanded] = useState(false);

  const activeAreaType: LocationAreaType = value.areaType ?? 'gang';

  // Reverse geocode via OpenStreetMap Nominatim in Pontianak
  const reverseGeocodePontianak = async (lat: number, lng: number) => {
    const fallback = nearestPontianakFallback(lat, lng);
    onChange({
      ...latestValueRef.current,
      lat,
      lng,
      address: fallback.address,
      district: fallback.district,
    });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=id`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      if (!res.ok) return;
      const data = (await res.json()) as NominatimResult;
      const road = data.address?.road || data.display_name?.split(',')[0];
      const suburb =
        data.address?.suburb ||
        data.address?.city_district ||
        'Kota Pontianak';
      if (road) {
        onChange({
          ...latestValueRef.current,
          lat,
          lng,
          address: road,
          district: `${suburb}, Kalimantan Barat`,
        });
      }
    } catch {
      // Keep clean nearest Pontianak fallback if offline/throttled
    }
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialCenter: [number, number] =
      value.lat && value.lng ? [value.lat, value.lng] : PONTIANAK_CENTER;

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 17,
      minZoom: 5,
      maxZoom: 20,
      zoomControl: false,
      fadeAnimation: false,
    });

    // High-res satellite imagery (real houses, roofs, housing complexes) + road labels overlay
    const esriImagery = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Imagery &copy; Esri · Maxar',
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

    // Street map: OpenStreetMap renders full house footprints, Gg. alleys, and Pontianak streets at z5-z20
    const streetLayer = L.tileLayer(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: '&copy; OpenStreetMap · Pontianak',
        minZoom: 5,
        maxNativeZoom: 19,
        maxZoom: 20,
        keepBuffer: 4,
        updateWhenIdle: false,
        zIndex: 1,
      }
    );

    esriImagery.addTo(map);
    hybridLabels.addTo(map);

    esriSatelliteRef.current = esriImagery;
    hybridLabelsRef.current = hybridLabels;
    streetLayerRef.current = streetLayer;

    const customIcon = L.divIcon({
      className: 'ecomove-pin-icon',
      html: PIN_HTML,
      iconSize: [32, 40],
      iconAnchor: [16, 40],
    });

    const marker = L.marker(initialCenter, {
      draggable: true,
      icon: customIcon,
    }).addTo(map);

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      reverseGeocodePontianak(pos.lat, pos.lng);
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      reverseGeocodePontianak(e.latlng.lat, e.latlng.lng);
    });

    map.on('zoomend', () => {
      setZoomLevel(map.getZoom());
    });

    // Debounced ResizeObserver to sync Leaflet tile bounds cleanly without race conditions
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const resizeObserver = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        map.invalidateSize({ animate: false, pan: false });
      }, 40);
    });
    resizeObserver.observe(mapContainerRef.current);

    mapInstanceRef.current = map;
    markerRef.current = marker;

    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
      esriSatelliteRef.current = null;
      hybridLabelsRef.current = null;
      streetLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch cleanly between Satellite (real houses) and Street map
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

  // Immediately invalidate Leaflet viewport and re-center pin when Perbesar / Perkecil is toggled
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const frameId = requestAnimationFrame(() => {
      map.invalidateSize({ animate: false, pan: false });
      const center: L.LatLngExpression = markerRef.current?.getLatLng() ?? [
        latestValueRef.current.lat,
        latestValueRef.current.lng,
      ];
      map.setView(center, map.getZoom(), { animate: false });
    });

    const timerId = setTimeout(() => {
      map.invalidateSize({ animate: false, pan: false });
    }, 100);

    if (isExpanded) {
      mapWrapperRef.current?.scrollIntoView({ behavior: 'auto', block: 'nearest' });
    }

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timerId);
    };
  }, [isExpanded]);

  useEffect(() => {
    if (mapInstanceRef.current && markerRef.current) {
      const current = markerRef.current.getLatLng();
      if (
        Math.abs(current.lat - value.lat) > 0.0001 ||
        Math.abs(current.lng - value.lng) > 0.0001
      ) {
        markerRef.current.setLatLng([value.lat, value.lng]);
        const targetZoom = Math.max(mapInstanceRef.current.getZoom(), 18);
        mapInstanceRef.current.setView([value.lat, value.lng], targetZoom, {
          animate: true,
        });
      }
    }
  }, [value.lat, value.lng]);

  // Debounced live Nominatim search scoped to Pontianak, Kalimantan Barat
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 3) {
      setOsmResults([]);
      setSearchingOsm(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearchingOsm(true);
      try {
        const queryStr = encodeURIComponent(`${q}, Pontianak, Kalimantan Barat`);
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${queryStr}&viewbox=${PONTIANAK_VIEWBOX}&bounded=1&limit=5&addressdetails=1&accept-language=id`,
          { signal: controller.signal }
        );
        if (!res.ok) {
          setSearchingOsm(false);
          return;
        }
        const rows = (await res.json()) as NominatimResult[];
        const mapped: LocationSelection[] = rows.map((row) => {
          const parts = row.display_name.split(',').map((p) => p.trim());
          return {
            lat: Number(row.lat),
            lng: Number(row.lon),
            address: row.address?.road || parts[0] || q,
            district:
              row.address?.suburb ||
              row.address?.city_district ||
              'Pontianak, Kalimantan Barat',
            note: latestValueRef.current.note,
            areaType: latestValueRef.current.areaType,
            gang: latestValueRef.current.gang,
            rt: latestValueRef.current.rt,
            rw: latestValueRef.current.rw,
            housingName: latestValueRef.current.housingName,
            houseNumber: latestValueRef.current.houseNumber,
          };
        });
        setOsmResults(mapped);
      } catch {
        // Ignore abort/network errors and rely on preset Pontianak list
      } finally {
        setSearchingOsm(false);
      }
    }, 450);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

  const presetFiltered = PRESET_LOCATIONS.filter((loc) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      loc.address.toLowerCase().includes(q) ||
      loc.district.toLowerCase().includes(q) ||
      (loc.gang ?? '').toLowerCase().includes(q) ||
      (loc.housingName ?? '').toLowerCase().includes(q)
    );
  });

  const combinedSuggestions =
    osmResults.length > 0 ? [...osmResults, ...presetFiltered] : presetFiltered;

  const handleSelectSuggestion = (loc: LocationSelection) => {
    onChange({
      ...value,
      ...loc,
      note: value.note || loc.note,
    });
    setSearchQuery('');
    setShowSuggestions(false);
  };

  const handleSelectSubAreaPreset = (preset: PontianakSubAreaPreset) => {
    onChange({
      ...value,
      areaType: preset.areaType,
      lat: preset.lat,
      lng: preset.lng,
      address: preset.address,
      district: preset.district,
      housingName: preset.housingName ?? '',
      gang: preset.gang ?? value.gang ?? '',
      rt: preset.rt,
      rw: preset.rw,
    });
  };

  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  const handleSetZoom = (targetZoom: number) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([value.lat, value.lng], targetZoom, {
        animate: true,
      });
    }
  };

  const handleUseCurrentLocation = () => {
    setLocating(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          if (isInsideKalbar(lat, lng)) {
            reverseGeocodePontianak(lat, lng);
          } else {
            const ptk = PRESET_LOCATIONS[0];
            onChange({
              ...value,
              lat: ptk.lat,
              lng: ptk.lng,
              address: ptk.address,
              district: ptk.district,
            });
          }
          setLocating(false);
        },
        () => {
          const ptk = PRESET_LOCATIONS[0];
          onChange({
            ...value,
            lat: ptk.lat,
            lng: ptk.lng,
            address: ptk.address,
            district: ptk.district,
          });
          setLocating(false);
        },
        { timeout: 3000 }
      );
    } else {
      const ptk = PRESET_LOCATIONS[0];
      onChange({
        ...value,
        lat: ptk.lat,
        lng: ptk.lng,
        address: ptk.address,
        district: ptk.district,
      });
      setLocating(false);
    }
  };

  const subAreaChoices = PONTIANAK_SUBAREA_PRESETS.filter((p) =>
    activeAreaType === 'jalan' ? true : p.areaType === activeAreaType
  );

  const areaTypeOptions: { id: LocationAreaType; label: string }[] = [
    { id: 'perumahan', label: t.areaTypeHousing },
    { id: 'kost', label: t.areaTypeKost },
    { id: 'asrama', label: t.areaTypeAsrama },
    { id: 'komplek', label: t.areaTypeComplex },
    { id: 'gang', label: t.areaTypeGang },
    { id: 'jalan', label: t.areaTypeMainRoad },
  ];

  const detailedString = formatLocationDetail(value);

  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] p-3.5 space-y-3 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <MapPin className="w-4 h-4 text-[#059669] shrink-0" />
          <div className="min-w-0">
            <h3 className="font-display text-xs font-bold text-[#0F172A] truncate">
              {t.mapSectionTitle}
            </h3>
            <p className="text-[10px] font-semibold text-[#059669] truncate">
              Pontianak, Kalimantan Barat
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={locating}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[34px] rounded-xl bg-[#ECFDF5] hover:bg-[#D1FAE5] text-[#059669] text-[11px] font-bold transition-colors cursor-pointer shrink-0 whitespace-nowrap"
        >
          <Crosshair className={`w-3.5 h-3.5 ${locating ? 'animate-spin' : ''}`} />
          <span>{locating ? t.locatingText : t.useCurrentLocBtn}</span>
        </button>
      </div>

      {/* Search Bar connected to Pontianak OSM Nominatim + Presets */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onFocus={() => setShowSuggestions(true)}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowSuggestions(true);
          }}
          placeholder={t.mapSearchPlaceholder}
          className="w-full min-h-[40px] pl-8 pr-8 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] focus:outline-none focus:border-[#10B981]"
        />
        {searchingOsm && (
          <Loader2 className="w-3.5 h-3.5 text-[#059669] animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
        )}

        {showSuggestions && (
          <div className="absolute z-30 left-0 right-0 mt-1 bg-white rounded-xl border border-[#CBD5E1] shadow-lg max-h-48 overflow-y-auto divide-y divide-[#F1F5F9]">
            {combinedSuggestions.map((loc, idx) => (
              <button
                key={`${loc.address}-${idx}`}
                type="button"
                onClick={() => handleSelectSuggestion(loc)}
                className="w-full text-left px-3 py-2.5 hover:bg-[#F8FAFC] flex items-start gap-2 cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5 text-[#059669] mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#0F172A] truncate">
                    {loc.housingName ? `${loc.housingName} · ` : ''}
                    {loc.address}
                  </p>
                  <p className="text-[11px] text-[#64748B] truncate">
                    {loc.gang ? `${loc.gang} · ` : ''}
                    {loc.rt && loc.rw ? `RT ${loc.rt}/RW ${loc.rw} · ` : ''}
                    {loc.district}
                  </p>
                </div>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowSuggestions(false)}
              className="w-full py-2 text-center text-[11px] font-semibold text-[#64748B] cursor-pointer"
            >
              {lang === 'id' ? 'Tutup' : 'Close'}
            </button>
          </div>
        )}
      </div>

      {/* Persistent Map Container with Floating Satelit / Peta Jalan + Perbesar / Perkecil + Zoom Controls */}
      <div
        ref={mapWrapperRef}
        className="relative rounded-xl overflow-hidden border border-[#CBD5E1] bg-[#E2E8F0]"
      >
        <div
          ref={mapContainerRef}
          style={{ height: isExpanded ? 420 : 230 }}
          className="w-full"
          aria-label="Peta Satelit dan Jalan Interaktif Pontianak Kalimantan Barat"
        />

        {/* Top-Left Floating Layer Switcher: Always visible in both Perbesar & Perkecil */}
        <div className="absolute top-2.5 left-2.5 z-[400] inline-flex rounded-xl bg-white/95 backdrop-blur-xs p-0.5 border border-[#CBD5E1] shadow-md">
          <button
            type="button"
            onClick={() => setMapMode('satellite')}
            title={t.mapLayerSatellite}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
              mapMode === 'satellite'
                ? 'bg-[#059669] text-white shadow-xs'
                : 'text-[#334155] hover:text-[#0F172A]'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>{lang === 'id' ? 'Satelit' : 'Satellite'}</span>
          </button>
          <button
            type="button"
            onClick={() => setMapMode('street')}
            title={t.mapLayerStreet}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
              mapMode === 'street'
                ? 'bg-[#059669] text-white shadow-xs'
                : 'text-[#334155] hover:text-[#0F172A]'
            }`}
          >
            <MapIcon className="w-3 h-3" />
            <span>{t.mapLayerStreet}</span>
          </button>
        </div>

        {/* Top-Right Floating Expand/Collapse + Zoom +/- Controls */}
        <div className="absolute top-2.5 right-2.5 z-[400] flex flex-col items-end gap-1.5">
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-xl bg-white/95 backdrop-blur-xs border border-[#CBD5E1] text-[10px] font-bold text-[#0F172A] shadow-md hover:border-[#10B981] cursor-pointer whitespace-nowrap"
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
              onClick={handleZoomIn}
              aria-label="Perbesar zoom peta"
              className="w-8 h-8 flex items-center justify-center text-[#0F172A] hover:bg-[#ECFDF5] border-b border-[#E2E8F0] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
            <div className="px-1 py-0.5 text-center font-mono-tabular text-[9px] font-bold text-[#059669] bg-[#F8FAFC] border-b border-[#E2E8F0]">
              {zoomLevel}x
            </div>
            <button
              type="button"
              onClick={handleZoomOut}
              aria-label="Perkecil zoom peta"
              className="w-8 h-8 flex items-center justify-center text-[#0F172A] hover:bg-[#ECFDF5] cursor-pointer"
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Bottom-Left Floating Quick Zoom Scale Buttons (Kota 14x / Komplek 17x / Rumah 19x) */}
        <div className="absolute bottom-6 left-2.5 z-[400] flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleSetZoom(14)}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold border shadow-sm cursor-pointer whitespace-nowrap ${
              zoomLevel <= 15
                ? 'bg-[#059669] text-white border-[#059669]'
                : 'bg-white/95 text-[#334155] border-[#CBD5E1]'
            }`}
          >
            {lang === 'id' ? 'Kota (14x)' : 'City (14x)'}
          </button>
          <button
            type="button"
            onClick={() => handleSetZoom(17)}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold border shadow-sm cursor-pointer whitespace-nowrap ${
              zoomLevel >= 16 && zoomLevel <= 18
                ? 'bg-[#059669] text-white border-[#059669]'
                : 'bg-white/95 text-[#334155] border-[#CBD5E1]'
            }`}
          >
            {lang === 'id' ? 'Komplek (17x)' : 'Area (17x)'}
          </button>
          <button
            type="button"
            onClick={() => handleSetZoom(19)}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border shadow-sm cursor-pointer whitespace-nowrap ${
              zoomLevel >= 19
                ? 'bg-[#059669] text-white border-[#059669]'
                : 'bg-white/95 text-[#059669] border-[#CBD5E1]'
            }`}
          >
            <ZoomIn className="w-3 h-3" />
            <span>{lang === 'id' ? 'Rumah (19x)' : 'House (19x)'}</span>
          </button>
        </div>
      </div>

      <p className="text-[11px] text-[#64748B]">{t.mapHelperText}</p>

      {/* Gang (Gg.), RT/RW, Perumahan, & Komplek Picker */}
      <div className="p-3 rounded-xl bg-[#F4F9F6] border border-[#D1FAE5] space-y-2.5">
        <div className="flex items-center gap-1.5">
          <Building className="w-3.5 h-3.5 text-[#059669] shrink-0" />
          <p className="text-[11px] font-bold text-[#0F172A]">{t.areaDetailTitle}</p>
        </div>

        {/* 6 Property / Area Type Tabs: Perumahan / Kost / Asrama / Komplek / Gang / Jalan Utama */}
        <div className="grid grid-cols-3 gap-1.5">
          {areaTypeOptions.map((opt) => {
            const selected = activeAreaType === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChange({ ...value, areaType: opt.id })}
                className={`py-1.5 px-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer whitespace-nowrap truncate ${
                  selected
                    ? 'bg-[#059669] text-white border-[#059669] shadow-xs'
                    : 'bg-white text-[#475569] border-[#E2E8F0] hover:border-[#10B981]'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Quick-Pick Popular Pontianak Komplek / Perumahan / Gang Chips */}
        <div className="space-y-1">
          <p className="text-[10px] text-[#64748B]">{t.quickPickAreaHint}</p>
          <div className="flex flex-wrap gap-1.5">
            {subAreaChoices.slice(0, 8).map((preset) => {
              const isSelected =
                (preset.housingName && value.housingName === preset.housingName) ||
                (!preset.housingName && preset.gang && value.gang === preset.gang);
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleSelectSubAreaPreset(preset)}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[#D1FAE5] border-[#059669] text-[#065F46]'
                      : 'bg-white border-[#E2E8F0] text-[#334155] hover:border-[#10B981]'
                  }`}
                >
                  <Navigation2 className="w-2.5 h-2.5 text-[#059669] shrink-0" />
                  <span>{preset.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Housing / Complex Name + Gang (Gg.) Inputs */}
        <div className="grid grid-cols-1 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-[#475569] mb-1">
              {t.housingOrComplexLabel}
            </label>
            <input
              type="text"
              value={value.housingName ?? ''}
              onChange={(e) => onChange({ ...value, housingName: e.target.value })}
              placeholder={t.housingOrComplexPlaceholder}
              className="w-full min-h-[36px] px-2.5 py-1.5 rounded-lg bg-white border border-[#E2E8F0] text-[11px] text-[#0F172A] focus:outline-none focus:border-[#10B981]"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-[#475569] mb-1">
              {t.gangLabel}
            </label>
            <input
              type="text"
              value={value.gang ?? ''}
              onChange={(e) => onChange({ ...value, gang: e.target.value })}
              placeholder={t.gangPlaceholder}
              className="w-full min-h-[36px] px-2.5 py-1.5 rounded-lg bg-white border border-[#E2E8F0] text-[11px] text-[#0F172A] focus:outline-none focus:border-[#10B981]"
            />
          </div>
        </div>

        {/* RT, RW, and House/Block Number */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-[#475569] mb-1">
              {t.rtLabel}
            </label>
            <select
              value={value.rt ?? '001'}
              onChange={(e) => onChange({ ...value, rt: e.target.value })}
              className="w-full min-h-[36px] px-2 py-1 rounded-lg bg-white border border-[#E2E8F0] text-[11px] font-mono-tabular text-[#0F172A] focus:outline-none focus:border-[#10B981]"
            >
              {RT_OPTIONS.map((rtOpt) => (
                <option key={rtOpt} value={rtOpt}>
                  RT {rtOpt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-[#475569] mb-1">
              {t.rwLabel}
            </label>
            <select
              value={value.rw ?? '001'}
              onChange={(e) => onChange({ ...value, rw: e.target.value })}
              className="w-full min-h-[36px] px-2 py-1 rounded-lg bg-white border border-[#E2E8F0] text-[11px] font-mono-tabular text-[#0F172A] focus:outline-none focus:border-[#10B981]"
            >
              {RW_OPTIONS.map((rwOpt) => (
                <option key={rwOpt} value={rwOpt}>
                  RW {rwOpt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-[#475569] mb-1">
              {t.houseNoLabel}
            </label>
            <input
              type="text"
              value={value.houseNumber ?? ''}
              onChange={(e) => onChange({ ...value, houseNumber: e.target.value })}
              placeholder={t.houseNoPlaceholder}
              className="w-full min-h-[36px] px-2 py-1.5 rounded-lg bg-white border border-[#E2E8F0] text-[11px] text-[#0F172A] focus:outline-none focus:border-[#10B981]"
            />
          </div>
        </div>
      </div>

      {/* Address Summary & Courier Note */}
      <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
        <div>
          <p className="text-xs font-bold text-[#0F172A] leading-snug">{value.address}</p>
          {detailedString && (
            <p className="text-[11px] font-semibold text-[#059669] flex items-center gap-1 mt-0.5">
              <Home className="w-3 h-3 shrink-0" />
              <span className="leading-snug">{detailedString}</span>
            </p>
          )}
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p className="text-[11px] text-[#64748B] truncate">{value.district}</p>
            <span className="font-mono-tabular text-[10px] text-[#64748B] shrink-0">
              {value.lat.toFixed(4)}, {value.lng.toFixed(4)}
            </span>
          </div>
        </div>

        <input
          type="text"
          value={value.note}
          onChange={(e) => onChange({ ...value, note: e.target.value })}
          placeholder={t.pickupNotePlaceholder}
          aria-label={t.pickupNoteLabel}
          className="w-full min-h-[36px] px-2.5 py-1.5 rounded-lg bg-white border border-[#E2E8F0] text-[11px] text-[#0F172A] focus:outline-none focus:border-[#10B981]"
        />
      </div>
    </div>
  );
}
