import type { KtmExtractedInfo, Language } from '../types/ecomove';

export interface VerifyKtmResult {
  isStudentCard: boolean;
  previewUrl: string;
  ktmInfo?: KtmExtractedInfo;
  rejectionReason?: string;
}

export function buildKtmCopiedSummary(params: {
  cardType: 'KTM' | 'Kartu Pelajar';
  campusName: string;
  nim: string;
  studentName: string;
  studyProgram?: string;
}): string {
  const lines: string[] = [
    `${params.cardType} · ${params.campusName || '-'}`,
    `NIM/NISN: ${params.nim || '-'}`,
  ];
  if (params.studentName) {
    lines.push(`Nama: ${params.studentName}`);
  }
  if (params.studyProgram) {
    lines.push(`Prodi/Jurusan: ${params.studyProgram}`);
  }
  return lines.join('\n');
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read image file.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

export async function normalizeImageToJpeg(
  source: File | string
): Promise<{ dataUrl: string; base64: string; mimeType: string }> {
  const rawDataUrl =
    typeof source === 'string' ? source : await readFileAsDataUrl(source);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 1280;
      const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
      const width = Math.max(1, Math.round((img.width || 640) * scale));
      const height = Math.max(1, Math.round((img.height || 400) * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable.'));
        return;
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      const jpegUrl = canvas.toDataURL('image/jpeg', 0.9);
      const base64 = jpegUrl.replace(/^data:image\/jpeg;base64,/, '');
      resolve({
        dataUrl: jpegUrl,
        base64,
        mimeType: 'image/jpeg',
      });
    };
    img.onerror = () => {
      const match = /^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/.exec(rawDataUrl);
      if (match) {
        resolve({
          dataUrl: rawDataUrl,
          base64: match[2],
          mimeType: match[1],
        });
        return;
      }
      reject(new Error('Invalid or unsupported image format.'));
    };
    img.src = rawDataUrl;
  });
}

export function createSamplePolteqKtmDataUrl(studentName?: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Card background
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(0, 0, 640, 400);

  // Header band
  ctx.fillStyle = '#065F46';
  ctx.fillRect(0, 0, 640, 94);
  ctx.fillStyle = '#10B981';
  ctx.fillRect(0, 88, 640, 6);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('POLITEKNIK TONGGAK EQUATOR', 28, 38);
  ctx.fillStyle = '#D1FAE5';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('KARTU TANDA MAHASISWA (KTM) · PONTIANAK', 28, 66);

  // Photo box
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(28, 122, 130, 165);
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 3;
  ctx.strokeRect(28, 122, 130, 165);

  ctx.fillStyle = '#64748B';
  ctx.beginPath();
  ctx.arc(93, 178, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(93, 260, 44, Math.PI, 0);
  ctx.fill();

  // Extracted details text
  const cleanName = (studentName?.trim() || 'NADIA KUSUMA').toUpperCase();
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('NAMA MAHASISWA', 184, 142);
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 23px sans-serif';
  ctx.fillText(cleanName, 184, 170);

  ctx.fillStyle = '#475569';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('NOMOR INDUK MAHASISWA (NIM)', 184, 206);
  ctx.fillStyle = '#059669';
  ctx.font = 'bold 22px monospace';
  ctx.fillText('2023104018', 184, 234);

  ctx.fillStyle = '#475569';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('PROGRAM STUDI / KAMPUS', 184, 268);
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('D3 Bahasa Inggris · POLITEKNIK TONGGAK EQUATOR', 184, 292);

  // Footer verification strip
  ctx.fillStyle = '#D1FAE5';
  ctx.fillRect(28, 326, 584, 46);
  ctx.fillStyle = '#065F46';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('STATUS: MAHASISWA AKTIF · PONTIANAK KALIMANTAN BARAT', 46, 355);

  return canvas.toDataURL('image/jpeg', 0.92);
}

interface VerifyApiResponse {
  isStudentCard?: boolean;
  cardType?: string;
  campusName?: string;
  nimOrNisn?: string;
  studentName?: string;
  studyProgram?: string;
  rejectionReason?: string;
  error?: string;
}

export async function verifyStudentCardImage(params: {
  source: File | string;
  lang: Language;
}): Promise<VerifyKtmResult> {
  const { source, lang } = params;
  const normalized = await normalizeImageToJpeg(source);

  const res = await fetch('/api/verify-ktm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64: normalized.base64,
      mimeType: normalized.mimeType,
      lang,
    }),
  });

  const payload = (await res.json().catch(() => ({}))) as VerifyApiResponse;

  if (!res.ok) {
    throw new Error(
      payload.error ||
        (lang === 'id'
          ? 'Gagal memverifikasi foto kartu mahasiswa/pelajar.'
          : 'Failed to verify student ID photo.')
    );
  }

  if (!payload.isStudentCard) {
    return {
      isStudentCard: false,
      previewUrl: normalized.dataUrl,
      rejectionReason:
        payload.rejectionReason ||
        (lang === 'id'
          ? 'Hanya Kartu Tanda Mahasiswa (KTM) atau Kartu Pelajar yang dapat terdeteksi. Foto ini tidak dikenali sebagai KTM/Kartu Pelajar.'
          : 'Only Kartu Tanda Mahasiswa (KTM) or Student ID cards can be detected.'),
    };
  }

  const cardType: 'KTM' | 'Kartu Pelajar' =
    payload.cardType === 'Kartu Pelajar' ? 'Kartu Pelajar' : 'KTM';
  const campusName = (payload.campusName || '').trim();
  const nim = (payload.nimOrNisn || '').trim();
  const studentName = (payload.studentName || '').trim();
  const studyProgram = (payload.studyProgram || '').trim();

  const copiedSummary = buildKtmCopiedSummary({
    cardType,
    campusName,
    nim,
    studentName,
    studyProgram,
  });

  navigator.clipboard?.writeText(copiedSummary).catch(() => {});

  return {
    isStudentCard: true,
    previewUrl: normalized.dataUrl,
    ktmInfo: {
      cardType,
      campusName,
      nim,
      studentName,
      studyProgram: studyProgram || undefined,
      copiedSummary,
    },
  };
}
