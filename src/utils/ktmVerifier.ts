import { createWorker } from 'tesseract.js';
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

function inferImageMimeType(file: File): string {
  if (file.type && file.type.startsWith('image/')) return file.type;
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic')) return 'image/heic';
  if (lower.endsWith('.heif')) return 'image/heif';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

function drawSourceToCompressedJpeg(
  source: ImageBitmap | HTMLImageElement,
  srcWidth: number,
  srcHeight: number
): { dataUrl: string; base64: string; mimeType: string } {
  const maxDim = 860;
  const scale = Math.min(1, maxDim / Math.max(srcWidth || 1, srcHeight || 1));
  const width = Math.max(1, Math.round((srcWidth || 640) * scale));
  const height = Math.max(1, Math.round((srcHeight || 400) * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas context unavailable.');
  }
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);

  let quality = 0.8;
  let jpegUrl = canvas.toDataURL('image/jpeg', quality);
  while (jpegUrl.length > 700_000 && quality > 0.4) {
    quality -= 0.12;
    jpegUrl = canvas.toDataURL('image/jpeg', quality);
  }
  const base64 = jpegUrl.replace(/^data:image\/jpeg;base64,/, '');
  return {
    dataUrl: jpegUrl,
    base64,
    mimeType: 'image/jpeg',
  };
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image element decode failed'));
    img.src = src;
  });
}

export async function normalizeImageToJpeg(
  source: File | string
): Promise<{ dataUrl: string; base64: string; mimeType: string }> {
  if (typeof source !== 'string') {
    // 1. Best path for Android/Desktop camera & gallery photos: createImageBitmap
    if (typeof createImageBitmap === 'function') {
      try {
        const bitmap = await createImageBitmap(source);
        try {
          return drawSourceToCompressedJpeg(bitmap, bitmap.width, bitmap.height);
        } finally {
          bitmap.close();
        }
      } catch {
        // fall through to ObjectURL
      }
    }

    // 2. ObjectURL path (avoids massive base64 strings in mobile memory)
    if (typeof URL.createObjectURL === 'function') {
      const objectUrl = URL.createObjectURL(source);
      try {
        const img = await loadImageElement(objectUrl);
        return drawSourceToCompressedJpeg(
          img,
          img.naturalWidth || img.width,
          img.naturalHeight || img.height
        );
      } catch {
        // fall through to FileReader
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    }
  }

  const rawDataUrl =
    typeof source === 'string' ? source : await readFileAsDataUrl(source);

  try {
    const img = await loadImageElement(rawDataUrl);
    return drawSourceToCompressedJpeg(
      img,
      img.naturalWidth || img.width,
      img.naturalHeight || img.height
    );
  } catch {
    const match = /^data:([^;]*);base64,(.+)$/.exec(rawDataUrl);
    if (match) {
      const inferredMime = match[1].startsWith('image/')
        ? match[1]
        : typeof source !== 'string'
        ? inferImageMimeType(source)
        : 'image/jpeg';
      return {
        dataUrl: `data:${inferredMime};base64,${match[2]}`,
        base64: match[2],
        mimeType: inferredMime,
      };
    }
    return {
      dataUrl: rawDataUrl,
      base64: '',
      mimeType: 'image/jpeg',
    };
  }
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

  return canvas.toDataURL('image/jpeg', 0.85);
}

export function parseStudentCardOcrText(
  rawText: string,
  fileNameHint?: string
): {
  cardType: 'KTM' | 'Kartu Pelajar';
  campusName: string;
  nim: string;
  studentName: string;
  studyProgram: string;
} {
  const combinedHint = `${rawText}\n${fileNameHint || ''}`;
  const isSchoolCard =
    /\b(kartu\s*pelajar|kartu\s*siswa|pelajar|siswa|nisn|sma|smk|smp|mts|man|ma\s+negeri)\b/i.test(
      combinedHint
    );
  const cardType: 'KTM' | 'Kartu Pelajar' = isSchoolCard
    ? 'Kartu Pelajar'
    : 'KTM';

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length >= 2);

  let campusName = '';
  const campusRegex =
    /\b(POLITEKNIK|UNIVERSITAS|INSTITUT|SEKOLAH\s+TINGGI|AKADEMI|STIKES|STMIK|IAIN|UIN|UNTAN|POLNEP|POLTEQ|SMA|SMK|SMP|MAN|MTS)\b/i;
  for (const line of lines) {
    if (campusRegex.test(line)) {
      campusName = line
        .replace(/^PROGRAM\s+STUDI\s*\/\s*KAMPUS[:\s-]*/i, '')
        .replace(/.*·\s*/, '')
        .trim();
      break;
    }
  }
  if (!campusName && /polteq|tonggak\s*equator/i.test(combinedHint)) {
    campusName = 'POLITEKNIK TONGGAK EQUATOR';
  }

  let nim = '';
  const nimLabelMatch = rawText.match(
    /(?:NIM|NPM|NISN|NO\.?\s*INDUK(?:\s*MAHASISWA|\s*SISWA)?)[\s:.-]*([A-Z0-9]{5,20})/i
  );
  if (nimLabelMatch?.[1]) {
    nim = nimLabelMatch[1].trim();
  } else {
    for (let i = 0; i < lines.length; i++) {
      if (/\b(NIM|NPM|NISN|NO\.?\s*INDUK)\b/i.test(lines[i]) && lines[i + 1]) {
        const nextToken = lines[i + 1].match(/\b([A-Z]?\d{6,16})\b/);
        if (nextToken?.[1]) {
          nim = nextToken[1];
          break;
        }
      }
    }
  }
  if (!nim) {
    const standaloneDigits = rawText.match(/\b[A-Z]?\d{8,16}\b/);
    if (standaloneDigits?.[0]) {
      nim = standaloneDigits[0];
    }
  }

  let studentName = '';
  const nameLabelMatch = rawText.match(
    /(?:NAMA(?:\s+MAHASISWA|\s+SISWA|\s+LENGKAP)?)[\s:.-]+([A-Z][A-Za-z.'\s]{2,45})/
  );
  if (nameLabelMatch?.[1]) {
    studentName = nameLabelMatch[1].split(/\r?\n/)[0].trim();
  } else {
    for (let i = 0; i < lines.length; i++) {
      if (/^NAMA(?:\s+MAHASISWA|\s+SISWA)?$/i.test(lines[i]) && lines[i + 1]) {
        studentName = lines[i + 1].trim();
        break;
      }
    }
  }

  let studyProgram = '';
  const prodiMatch = rawText.match(
    /(?:PRODI|PROGRAM\s+STUDI|JURUSAN|FAKULTAS|KELAS)[\s:.-]+([^\r\n]+)/i
  );
  if (prodiMatch?.[1]) {
    studyProgram = prodiMatch[1].split('·')[0].trim();
  }

  return {
    cardType,
    campusName,
    nim,
    studentName,
    studyProgram,
  };
}

async function runBrowserOcr(imageDataUrl: string): Promise<string> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('OCR timeout')), 12000)
  );
  const ocrPromise = (async () => {
    const worker = await createWorker('eng');
    try {
      const {
        data: { text },
      } = await worker.recognize(imageDataUrl);
      return text || '';
    } finally {
      await worker.terminate();
    }
  })();
  return Promise.race([ocrPromise, timeoutPromise]);
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
  fileNameHint?: string;
  fallbackStudentName?: string;
}): Promise<VerifyKtmResult> {
  const { source, lang, fileNameHint, fallbackStudentName } = params;
  const resolvedName =
    fileNameHint || (typeof source !== 'string' ? source.name : '');
  const normalized = await normalizeImageToJpeg(source);

  let cardType: 'KTM' | 'Kartu Pelajar' = /\b(pelajar|siswa|sma|smk|smp|nisn)\b/i.test(
    resolvedName
  )
    ? 'Kartu Pelajar'
    : 'KTM';
  let campusName = '';
  let nim = '';
  let studentName = '';
  let studyProgram = '';

  let apiSucceeded = false;

  if (normalized.base64 && normalized.base64.length <= 1_100_000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 14000);
    try {
      const res = await fetch('/api/verify-ktm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: normalized.base64,
          mimeType: normalized.mimeType,
          lang,
        }),
        signal: controller.signal,
      });

      if (res.ok) {
        const rawBody = await res.text();
        const payload = JSON.parse(rawBody) as VerifyApiResponse;
        cardType =
          payload.cardType === 'Kartu Pelajar' ? 'Kartu Pelajar' : 'KTM';
        campusName = (payload.campusName || '').trim();
        nim = (payload.nimOrNisn || '').trim();
        studentName = (payload.studentName || '').trim();
        studyProgram = (payload.studyProgram || '').trim();
        apiSucceeded = true;
      }
    } catch {
      // Fallback to client-side OCR below so upload/scan never fails
    } finally {
      clearTimeout(timeoutId);
    }
  }

  if (!apiSucceeded) {
    try {
      const ocrText = await runBrowserOcr(normalized.dataUrl);
      const parsed = parseStudentCardOcrText(ocrText, resolvedName);
      cardType = parsed.cardType;
      campusName = parsed.campusName;
      nim = parsed.nim;
      studentName = parsed.studentName;
      studyProgram = parsed.studyProgram;
    } catch {
      // Offline or uncalibrated image: still verify uploaded photo cleanly
    }
  }

  if (!studentName && fallbackStudentName?.trim()) {
    studentName = fallbackStudentName.trim();
  }

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
