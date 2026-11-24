import { useState } from 'react';
import { Camera, CheckCircle2, Columns2, Maximize2, MoveHorizontal, X } from 'lucide-react';
import type { Language, LocationSelection } from '../types/ecomove';
import { formatLocationDetail } from '../data/mockData';
import { getT } from '../i18n/translations';
import perumahanBeforeImg from '../assets/images/pickup_before_proof_1795497177343.jpg';
import perumahanAfterImg from '../assets/images/pickup_after_proof_1795497191214.jpg';
import gangBeforeImg from '../assets/images/gang_before_proof_1795498422769.jpg';
import gangAfterImg from '../assets/images/gang_after_proof_1795498438468.jpg';
import komplekBeforeImg from '../assets/images/komplek_before_proof_1795498423264.jpg';
import komplekAfterImg from '../assets/images/komplek_after_proof_1795498440095.jpg';
import kostBeforeImg from '../assets/images/kost_before_proof_1795504825732.jpg';
import kostAfterImg from '../assets/images/kost_after_proof_clean_1795504842879.jpg';
import asramaBeforeImg from '../assets/images/asrama_before_proof_1795504826964.jpg';
import asramaAfterImg from '../assets/images/asrama_after_proof_clean_1795504842719.jpg';

interface BeforeAfterProofProps {
  lang: Language;
  courierName: string;
  address: string;
  location?: LocationSelection;
  beforeTime?: string;
  completedTime: string | null;
}

type ProofSceneKey = 'perumahan' | 'kost' | 'asrama' | 'komplek' | 'gang';

interface ProofPhotoPair {
  beforeSrc: string;
  afterSrc: string;
  sceneLabelId: string;
  sceneLabelEn: string;
}

const PROOF_PHOTO_PAIRS: Record<ProofSceneKey, ProofPhotoPair> = {
  perumahan: {
    beforeSrc: perumahanBeforeImg,
    afterSrc: perumahanAfterImg,
    sceneLabelId: 'Rumah / Perumahan',
    sceneLabelEn: 'Residential Housing',
  },
  kost: {
    beforeSrc: kostBeforeImg,
    afterSrc: kostAfterImg,
    sceneLabelId: 'Area Kost Mahasiswa',
    sceneLabelEn: 'Student Boarding (Kost)',
  },
  asrama: {
    beforeSrc: asramaBeforeImg,
    afterSrc: asramaAfterImg,
    sceneLabelId: 'Area Asrama',
    sceneLabelEn: 'Student Dormitory',
  },
  komplek: {
    beforeSrc: komplekBeforeImg,
    afterSrc: komplekAfterImg,
    sceneLabelId: 'Kawasan Komplek',
    sceneLabelEn: 'Housing Complex',
  },
  gang: {
    beforeSrc: gangBeforeImg,
    afterSrc: gangAfterImg,
    sceneLabelId: 'Area Gang (Gg.)',
    sceneLabelEn: 'Alleyway (Gg.)',
  },
};

function resolveProofPhotoPair(
  address: string,
  location?: LocationSelection
): ProofPhotoPair {
  // 1. Always respect explicit user-selected property/area type first
  if (location?.areaType === 'asrama') return PROOF_PHOTO_PAIRS.asrama;
  if (location?.areaType === 'kost') return PROOF_PHOTO_PAIRS.kost;
  if (location?.areaType === 'komplek') return PROOF_PHOTO_PAIRS.komplek;
  if (location?.areaType === 'perumahan') return PROOF_PHOTO_PAIRS.perumahan;
  if (location?.areaType === 'gang') return PROOF_PHOTO_PAIRS.gang;

  // 2. Fallback keyword detection from housing name, gang, or street address
  const combined = `${location?.housingName ?? ''} ${location?.gang ?? ''} ${address}`.toLowerCase();

  if (/\basrama\b|polteq|rusunawa|dorm/.test(combined)) {
    return PROOF_PHOTO_PAIRS.asrama;
  }
  if (/\bkost\b|\bkos\b|indekos|melati/.test(combined)) {
    return PROOF_PHOTO_PAIRS.kost;
  }
  if (/\bkomp\.?\b|komplek|square|mitra indah|ari karya|bali agung/.test(combined)) {
    return PROOF_PHOTO_PAIRS.komplek;
  }
  if (/\bperum\.?\b|perumahan|griya|puri|villa|residence/.test(combined)) {
    return PROOF_PHOTO_PAIRS.perumahan;
  }
  if (/\bgg\.?\b|\bgang\b|sepakat|hijas|selamat|murni/.test(combined)) {
    return PROOF_PHOTO_PAIRS.gang;
  }

  // 3. Deterministic variation by address + coordinates for main road / custom pins
  const seedStr = `${address}|${location?.lat?.toFixed(4) ?? ''}|${location?.lng?.toFixed(4) ?? ''}`;
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash * 31 + seedStr.charCodeAt(i)) >>> 0;
  }
  const buckets: ProofSceneKey[] = [
    'perumahan',
    'kost',
    'asrama',
    'komplek',
    'gang',
  ];
  return PROOF_PHOTO_PAIRS[buckets[hash % buckets.length]];
}

interface ProofPhotoProps {
  src: string;
  alt: string;
  badgeText: string;
  variant: 'before' | 'after';
  badgePosition?: 'left' | 'right';
}

function ProofPhoto({
  src,
  alt,
  badgeText,
  variant,
  badgePosition = 'left',
}: ProofPhotoProps) {
  return (
    <div className="relative w-full h-full bg-[#E2E8F0] select-none overflow-hidden">
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        draggable={false}
        className="w-full h-full object-cover object-center"
      />
      <div
        className={`absolute top-2 ${
          badgePosition === 'right' ? 'right-2' : 'left-2'
        } px-2 py-0.5 rounded-md text-[10px] font-mono-tabular font-bold tracking-tight shadow-xs backdrop-blur-[2px] ${
          variant === 'after'
            ? 'bg-[#059669]/90 text-white'
            : 'bg-[#0F172A]/80 text-[#FDE68A]'
        }`}
      >
        {badgeText}
      </div>
    </div>
  );
}

export function BeforeAfterProof({
  lang,
  courierName,
  address,
  location,
  beforeTime,
  completedTime,
}: BeforeAfterProofProps) {
  const t = getT(lang);
  const [viewMode, setViewMode] = useState<'slider' | 'side'>('side');
  const [sliderPos, setSliderPos] = useState(50);
  const [previewTarget, setPreviewTarget] = useState<'before' | 'after' | null>(null);

  const photoPair = resolveProofPhotoPair(address, location);
  const locationDetail = location ? formatLocationDetail(location) : '';
  const beforeTs = beforeTime || '14:12 WIB';
  const afterTs = completedTime || '14:18 WIB';
  const beforeBadge = `${lang === 'id' ? 'SEBELUM' : 'BEFORE'} · ${beforeTs}`;
  const afterBadge = `${lang === 'id' ? 'SESUDAH (BERSIH)' : 'AFTER (CLEAN)'} · ${afterTs}`;

  return (
    <>
      <div className="bg-white rounded-2xl border border-[#A7F3D0] p-3.5 space-y-3 shadow-xs">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[#059669]">
              <Camera className="w-4 h-4 shrink-0" />
              <h3 className="font-display text-xs font-bold">{t.beforeAfterTitle}</h3>
            </div>
            <p className="text-[11px] text-[#64748B] mt-0.5 leading-snug">
              {t.beforeAfterSubtitle}
            </p>
          </div>
          <span className="px-2 py-0.5 rounded-md bg-[#ECFDF5] border border-[#A7F3D0] text-[9px] font-bold text-[#059669] shrink-0 whitespace-nowrap">
            {lang === 'id' ? photoPair.sceneLabelId : photoPair.sceneLabelEn}
          </span>
        </div>

        {/* Mode Switch */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#F1F5F9]">
          <button
            type="button"
            onClick={() => setViewMode('side')}
            className={`inline-flex items-center justify-center gap-1 py-1.5 min-h-[34px] rounded-lg text-[11px] font-bold cursor-pointer ${
              viewMode === 'side' ? 'bg-white text-[#059669] shadow-xs' : 'text-[#64748B]'
            }`}
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span>{t.viewSideBySide}</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('slider')}
            className={`inline-flex items-center justify-center gap-1 py-1.5 min-h-[34px] rounded-lg text-[11px] font-bold cursor-pointer ${
              viewMode === 'slider' ? 'bg-white text-[#059669] shadow-xs' : 'text-[#64748B]'
            }`}
          >
            <MoveHorizontal className="w-3.5 h-3.5" />
            <span>{t.viewSlider}</span>
          </button>
        </div>

        {viewMode === 'side' ? (
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setPreviewTarget('before')}
              className="group text-left rounded-xl overflow-hidden border border-[#E2E8F0] bg-[#F8FAFC] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#10B981]"
            >
              <div className="relative aspect-[4/3] w-full">
                <ProofPhoto
                  src={photoPair.beforeSrc}
                  alt={t.beforeLabel}
                  badgeText={beforeTs}
                  variant="before"
                />
                <span className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-md bg-black/55 text-white flex items-center justify-center opacity-85 group-hover:opacity-100">
                  <Maximize2 className="w-3 h-3" />
                </span>
              </div>
              <div className="px-2.5 py-1.5 flex items-center justify-between text-[10px]">
                <span className="font-bold text-[#0F172A]">{t.beforeLabel}</span>
                <span className="font-mono-tabular text-[#64748B]">{beforeTs}</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setPreviewTarget('after')}
              className="group text-left rounded-xl overflow-hidden border border-[#A7F3D0] bg-[#ECFDF5] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#10B981]"
            >
              <div className="relative aspect-[4/3] w-full">
                <ProofPhoto
                  src={photoPair.afterSrc}
                  alt={t.afterLabel}
                  badgeText={afterTs}
                  variant="after"
                />
                <span className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-md bg-black/55 text-white flex items-center justify-center opacity-85 group-hover:opacity-100">
                  <Maximize2 className="w-3 h-3" />
                </span>
              </div>
              <div className="px-2.5 py-1.5 flex items-center justify-between text-[10px]">
                <span className="font-bold text-[#059669] flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {t.afterLabel}
                </span>
                <span className="font-mono-tabular text-[#059669]">{afterTs}</span>
              </div>
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative aspect-[4/3] w-full rounded-xl overflow-hidden border border-[#E2E8F0] select-none">
              <div className="absolute inset-0">
                <ProofPhoto
                  src={photoPair.afterSrc}
                  alt={t.afterLabel}
                  badgeText={afterBadge}
                  variant="after"
                  badgePosition="right"
                />
              </div>
              <div
                className="absolute inset-0"
                style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
              >
                <ProofPhoto
                  src={photoPair.beforeSrc}
                  alt={t.beforeLabel}
                  badgeText={beforeBadge}
                  variant="before"
                  badgePosition="left"
                />
              </div>
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white shadow pointer-events-none"
                style={{ left: `${sliderPos}%` }}
              >
                <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[#059669] text-white border-2 border-white flex items-center justify-center shadow">
                  <MoveHorizontal className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
            <input
              type="range"
              min={5}
              max={95}
              value={sliderPos}
              onChange={(e) => setSliderPos(Number(e.target.value))}
              aria-label={t.viewSlider}
              className="w-full accent-[#059669] cursor-pointer"
            />
          </div>
        )}

        <div className="pt-2 border-t border-[#F1F5F9] text-[11px] text-[#64748B] space-y-0.5">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-medium text-[#0F172A]">{courierName}</span>
            <span className="truncate max-w-[190px] text-right">{address}</span>
          </div>
          {locationDetail && (
            <p className="text-[10px] font-semibold text-[#059669] truncate text-right">
              {locationDetail}
            </p>
          )}
        </div>
      </div>

      {/* Fullscreen Photo Proof Lightbox */}
      {previewTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-[2px] flex items-center justify-center p-4"
          onClick={() => setPreviewTarget(null)}
        >
          <div
            className="w-full max-w-[360px] bg-white rounded-2xl overflow-hidden shadow-xl border border-[#E2E8F0]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3.5 py-2.5 flex items-center justify-between border-b border-[#F1F5F9]">
              <div className="flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-[#059669]" />
                <span className="text-xs font-bold text-[#0F172A]">
                  {previewTarget === 'before' ? t.beforeLabel : t.afterLabel}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewTarget(null)}
                aria-label="Close"
                className="w-7 h-7 rounded-lg bg-[#F1F5F9] text-[#475569] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="aspect-[4/3] w-full">
              <ProofPhoto
                src={previewTarget === 'before' ? photoPair.beforeSrc : photoPair.afterSrc}
                alt={previewTarget === 'before' ? t.beforeLabel : t.afterLabel}
                badgeText={previewTarget === 'before' ? beforeBadge : afterBadge}
                variant={previewTarget}
              />
            </div>

            <div className="p-3 bg-[#F8FAFC] space-y-2.5">
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setPreviewTarget('before')}
                  className={`py-2 rounded-xl text-[11px] font-bold cursor-pointer border ${
                    previewTarget === 'before'
                      ? 'bg-[#0F172A] text-[#FDE68A] border-[#0F172A]'
                      : 'bg-white text-[#475569] border-[#E2E8F0]'
                  }`}
                >
                  {t.beforeLabel}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTarget('after')}
                  className={`py-2 rounded-xl text-[11px] font-bold cursor-pointer border ${
                    previewTarget === 'after'
                      ? 'bg-[#059669] text-white border-[#059669]'
                      : 'bg-white text-[#475569] border-[#E2E8F0]'
                  }`}
                >
                  {t.afterLabel}
                </button>
              </div>
              <div className="text-[11px] text-[#64748B] space-y-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-[#0F172A]">{courierName}</span>
                  <span className="truncate max-w-[190px] text-right">{address}</span>
                </div>
                {locationDetail && (
                  <p className="text-[10px] font-semibold text-[#059669] truncate text-right">
                    {locationDetail}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
