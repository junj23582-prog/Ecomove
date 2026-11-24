import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  RefreshCw,
  ScanLine,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import type { KtmExtractedInfo, Language } from '../types/ecomove';
import { playConfirmTone } from '../utils/audio';
import {
  createSamplePolteqKtmDataUrl,
  verifyStudentCardImage,
} from '../utils/ktmVerifier';

interface KtmScannerModalProps {
  lang: Language;
  studentName: string;
  onClose: () => void;
  onCaptured: (result: {
    previewUrl: string;
    fileName: string;
    ktmInfo: KtmExtractedInfo;
  }) => void;
}

export function KtmScannerModal({
  lang,
  studentName,
  onClose,
  onCaptured,
}: KtmScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraState, setCameraState] = useState<'loading' | 'live' | 'unavailable'>(
    'loading'
  );
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [copiedFlag, setCopiedFlag] = useState(false);
  const [scannedResult, setScannedResult] = useState<{
    previewUrl: string;
    fileName: string;
    ktmInfo: KtmExtractedInfo;
  } | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    setCameraState('loading');
    stopCamera();
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('unavailable');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraState('live');
    } catch {
      setCameraState('unavailable');
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const analyzeCardSource = async (source: File | string, fileName: string) => {
    setScanning(true);
    setScanError('');
    try {
      const result = await verifyStudentCardImage({ source, lang });
      if (!result.isStudentCard || !result.ktmInfo) {
        setScanError(
          result.rejectionReason ||
            (lang === 'id'
              ? 'Hanya Kartu Tanda Mahasiswa (KTM) atau Kartu Pelajar yang dapat terdeteksi.'
              : 'Only Student ID cards (KTM / Kartu Pelajar) are accepted.')
        );
        setScanning(false);
        return;
      }

      playConfirmTone();
      stopCamera();
      setCopiedFlag(true);
      setScannedResult({
        previewUrl: result.previewUrl,
        fileName,
        ktmInfo: result.ktmInfo,
      });
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : lang === 'id'
          ? 'Gagal memindai gambar KTM / Kartu Pelajar.'
          : 'Failed to scan Student ID image.';
      setScanError(msg);
    } finally {
      setScanning(false);
    }
  };

  const handleCaptureCamera = () => {
    if (cameraState === 'live' && videoRef.current && videoRef.current.videoWidth > 0) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const capturedDataUrl = canvas.toDataURL('image/jpeg', 0.92);
        void analyzeCardSource(capturedDataUrl, `KTM_Camera_${Date.now()}.jpg`);
        return;
      }
    }
    const sampleUrl = createSamplePolteqKtmDataUrl(studentName);
    void analyzeCardSource(sampleUrl, `KTM_Polteq_${Date.now()}.jpg`);
  };

  const handleUploadFromScanner = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    void analyzeCardSource(file, file.name);
  };

  const handleCopySummary = () => {
    if (!scannedResult) return;
    navigator.clipboard?.writeText(scannedResult.ktmInfo.copiedSummary).catch(() => {});
    setCopiedFlag(true);
    setTimeout(() => setCopiedFlag(false), 2000);
  };

  return (
    <div
      className="absolute inset-0 z-50 bg-[#0F172A]/95 text-white flex flex-col justify-between p-4 overflow-y-auto mobile-scroll"
      role="dialog"
      aria-modal="true"
    >
      {/* Top Scanner Header */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#10B981]/20 text-[#34D399] flex items-center justify-center shrink-0">
            <ScanLine className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-sm font-bold truncate">
              {lang === 'id'
                ? 'Deteksi KTM / Kartu Pelajar'
                : 'Detect Student ID (KTM)'}
            </h2>
            <p className="text-[11px] text-[#94A3B8] truncate">
              {lang === 'id'
                ? 'Deteksi otomatis · Keterangan kartu langsung tersalin'
                : 'Auto-detect · Card details automatically copied'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            stopCamera();
            onClose();
          }}
          aria-label="Close scanner"
          className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Viewfinder / Scanned Result */}
      <div className="my-auto py-3 space-y-3">
        {!scannedResult ? (
          <>
            <div className="relative aspect-[16/10] w-full rounded-2xl overflow-hidden bg-[#1E293B] border-2 border-[#10B981] shadow-lg">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className={`w-full h-full object-cover ${
                  cameraState === 'live' ? 'opacity-100' : 'opacity-0'
                }`}
              />

              {cameraState !== 'live' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-gradient-to-br from-[#0F172A] to-[#1E293B]">
                  <div className="w-full max-w-[270px] rounded-xl border border-dashed border-[#34D399]/60 bg-[#059669]/15 p-3 space-y-1.5">
                    <Camera className="w-6 h-6 text-[#34D399] mx-auto" />
                    <p className="text-xs font-bold text-white">
                      {cameraState === 'loading'
                        ? lang === 'id'
                          ? 'Membuka kamera perangkat...'
                          : 'Opening device camera...'
                        : lang === 'id'
                        ? 'Arahkan atau Upload Foto KTM / Kartu Pelajar'
                        : 'Capture or Upload Student ID Card'}
                    </p>
                    <p className="text-[10px] text-[#CBD5E1] leading-snug">
                      {lang === 'id'
                        ? 'Setiap foto yang diupload pada fitur KTM / Kartu Pelajar langsung terdeteksi beserta keterangan kampus & NIM.'
                        : 'Any uploaded photo is detected and visible campus & ID details are automatically copied.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Corner alignment brackets */}
              <div className="absolute inset-3 pointer-events-none">
                <div className="absolute top-0 left-0 w-5 h-5 border-t-3 border-l-3 border-[#34D399] rounded-tl-md" />
                <div className="absolute top-0 right-0 w-5 h-5 border-t-3 border-r-3 border-[#34D399] rounded-tr-md" />
                <div className="absolute bottom-0 left-0 w-5 h-5 border-b-3 border-l-3 border-[#34D399] rounded-bl-md" />
                <div className="absolute bottom-0 right-0 w-5 h-5 border-b-3 border-r-3 border-[#34D399] rounded-br-md" />
              </div>

              {scanning && (
                <div className="absolute inset-x-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 bg-[#0F172A]/85 py-3 px-3 rounded-xl">
                  <div className="w-full h-0.5 bg-[#34D399] shadow-[0_0_10px_#34D399]" />
                  <p className="text-xs font-bold text-[#A7F3D0] flex items-center gap-1.5 text-center">
                    <Sparkles className="w-3.5 h-3.5 animate-pulse shrink-0" />
                    <span>
                      {lang === 'id'
                        ? 'Mendeteksi KTM / Kartu Pelajar & menyalin teks...'
                        : 'Detecting Student ID & copying card text...'}
                    </span>
                  </p>
                </div>
              )}
            </div>

            {scanError && (
              <div className="p-3 rounded-xl bg-[#7F1D1D]/90 border border-[#F87171] text-white text-[11px] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-[#FCA5A5] shrink-0 mt-0.5" />
                <p className="leading-snug">{scanError}</p>
              </div>
            )}
          </>
        ) : (
          /* Scanned Preview & Automatically Copied Card Info */
          <div className="bg-white text-[#0F172A] rounded-2xl p-3.5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#059669]">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  {scannedResult.ktmInfo.cardType}{' '}
                  {lang === 'id' ? 'Terdeteksi!' : 'Verified!'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopySummary}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#ECFDF5] border border-[#A7F3D0] text-[10px] font-bold text-[#059669] cursor-pointer"
              >
                {copiedFlag ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span>
                  {copiedFlag
                    ? lang === 'id'
                      ? 'Otomatis Disalin'
                      : 'Auto-Copied'
                    : lang === 'id'
                    ? 'Salin Data'
                    : 'Copy'}
                </span>
              </button>
            </div>

            <img
              src={scannedResult.previewUrl}
              alt="Scanned KTM"
              referrerPolicy="no-referrer"
              className="w-full h-36 object-contain rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]"
            />

            <div className="p-2.5 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] space-y-1.5 text-[11px]">
              <div className="flex justify-between gap-2">
                <span className="text-[#475569] shrink-0">
                  {lang === 'id' ? 'Jenis Kartu' : 'Card Type'}:
                </span>
                <span className="font-bold text-[#059669] text-right">
                  {scannedResult.ktmInfo.cardType}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#475569] shrink-0">
                  {lang === 'id' ? 'Kampus / Sekolah' : 'Institution'}:
                </span>
                <span className="font-bold text-[#0F172A] text-right">
                  {scannedResult.ktmInfo.campusName || '-'}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#475569] shrink-0">NIM / NISN:</span>
                <span className="font-mono-tabular font-bold text-[#059669] text-right">
                  {scannedResult.ktmInfo.nim || '-'}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#475569] shrink-0">
                  {lang === 'id' ? 'Nama Tertera' : 'Card Name'}:
                </span>
                <span className="font-bold text-[#0F172A] text-right">
                  {scannedResult.ktmInfo.studentName || studentName || '-'}
                </span>
              </div>
              {scannedResult.ktmInfo.studyProgram && (
                <div className="flex justify-between gap-2">
                  <span className="text-[#475569] shrink-0">
                    {lang === 'id' ? 'Prodi / Jurusan' : 'Program'}:
                  </span>
                  <span className="font-semibold text-[#0F172A] text-right">
                    {scannedResult.ktmInfo.studyProgram}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action Controls */}
      <div className="space-y-2 pb-2 shrink-0">
        {!scannedResult ? (
          <>
            <button
              type="button"
              disabled={scanning}
              onClick={handleCaptureCamera}
              className="w-full min-h-[46px] rounded-2xl bg-[#10B981] hover:bg-[#059669] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md disabled:opacity-60 cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>
                {scanning
                  ? lang === 'id'
                    ? 'Memverifikasi Kartu...'
                    : 'Verifying Card...'
                  : cameraState === 'live'
                  ? lang === 'id'
                    ? 'Ambil Foto & Deteksi KTM'
                    : 'Capture & Detect Student ID'
                  : lang === 'id'
                  ? 'Contoh KTM (Politeknik Tonggak Equator)'
                  : 'Sample KTM (Politeknik Tonggak Equator)'}
              </span>
            </button>

            <label className="w-full min-h-[42px] rounded-2xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4 text-[#34D399]" />
              <span>
                {lang === 'id'
                  ? 'Upload Foto KTM / Kartu Pelajar dari Galeri'
                  : 'Upload Student ID Photo from Gallery'}
              </span>
              <input
                type="file"
                accept="image/*"
                disabled={scanning}
                onChange={handleUploadFromScanner}
                className="sr-only"
              />
            </label>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                setScannedResult(null);
                setScanError('');
                startCamera();
              }}
              className="min-h-[44px] rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{lang === 'id' ? 'Scan Ulang' : 'Rescan'}</span>
            </button>
            <button
              type="button"
              onClick={() => onCaptured(scannedResult)}
              className="min-h-[44px] rounded-xl bg-[#10B981] hover:bg-[#059669] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{lang === 'id' ? 'Gunakan KTM Ini' : 'Use This ID'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

