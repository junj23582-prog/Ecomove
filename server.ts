import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

interface VerifyKtmBody {
  imageBase64?: string;
  mimeType?: string;
  lang?: 'id' | 'en';
}

interface GeminiKtmAnalysis {
  isStudentCard?: boolean;
  cardType?: string;
  campusName?: string;
  nimOrNisn?: string;
  studentName?: string;
  studyProgram?: string;
  rejectionReason?: string;
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY_MISSING');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '20mb' }));

  app.post('/api/verify-ktm', async (req, res) => {
    const body = (req.body || {}) as VerifyKtmBody;
    const rawBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64.trim() : '';
    const mimeType =
      typeof body.mimeType === 'string' && body.mimeType.startsWith('image/')
        ? body.mimeType
        : 'image/jpeg';
    const lang = body.lang === 'en' ? 'en' : 'id';

    if (!rawBase64) {
      res.status(400).json({
        error:
          lang === 'id'
            ? 'Gambar foto yang diupload tidak ditemukan.'
            : 'Uploaded image payload is missing.',
      });
      return;
    }

    const cleanBase64 = rawBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');

    let ai: GoogleGenAI;
    try {
      ai = getGeminiClient();
    } catch {
      res.status(503).json({
        error:
          lang === 'id'
            ? 'Layanan deteksi KTM membutuhkan GEMINI_API_KEY pada Settings > Secrets.'
            : 'KTM detection requires GEMINI_API_KEY in Settings > Secrets.',
      });
      return;
    }

    const promptText =
      lang === 'id'
        ? `Anda adalah sistem OCR & deteksi dokumen EcoMove Indonesia.
Tugas Anda adalah mendeteksi dan mengekstrak keterangan dari gambar apa pun yang diunggah pengguna pada fitur Upload Foto KTM / Kartu Pelajar:
1. DETEKSI UNIVERSAL: Setel isStudentCard = true untuk setiap gambar yang diunggah agar proses upload selalu berhasil terdeteksi, baik itu foto KTM fisik, Kartu Pelajar, tangkapan layar kartu digital, foto buram/miring, maupun foto lainnya.
2. EKSTRAKSI TEKS OTOMATIS: Baca dan salin PERSIS keterangan yang terlihat pada gambar:
   - cardType: isi "Kartu Pelajar" jika gambar adalah Kartu Pelajar / Kartu Siswa sekolah; selain itu isi "KTM".
   - campusName: salin NAMA KAMPUS / PERGURUAN TINGGI / SEKOLAH / INSTANSI yang tertulis pada gambar (contoh: "POLITEKNIK TONGGAK EQUATOR", "UNIVERSITAS TANJUNGPURA", "SMA NEGERI 1 PONTIANAK"). Jika tidak ada nama kampus/instansi yang tertulis, isi "".
   - nimOrNisn: salin NOMOR NIM / NPM / NISN / No. Induk / nomor identitas yang tertulis pada gambar. Jika tidak ada, isi "".
   - studentName: salin NAMA LENGKAP yang tertulis pada gambar. Jika tidak ada, isi "".
   - studyProgram: salin Program Studi / Jurusan / Fakultas / Kelas jika tertulis pada gambar (kosongkan "" jika tidak ada).
   - rejectionReason: kosongkan "".`
        : `You are EcoMove Indonesia's document OCR & detection system.
Analyze any image uploaded by the user in the Upload Student ID (KTM / Kartu Pelajar) feature:
1. UNIVERSAL DETECTION: Always set isStudentCard = true so every uploaded image is detected, whether it is a physical KTM, Kartu Pelajar, digital screenshot, angled/blurry photo, or any other uploaded image.
2. EXACT TEXT EXTRACTION: Read and copy any text printed or visible on the image:
   - cardType: "Kartu Pelajar" if it is a school student ID; otherwise "KTM".
   - campusName: exact university/polytechnic/school/institution name printed on the image (e.g., "POLITEKNIK TONGGAK EQUATOR"). Return "" if none is visible.
   - nimOrNisn: exact NIM / NPM / NISN / ID number printed on the image. Return "" if none is visible.
   - studentName: exact full name printed on the image. Return "" if none is visible.
   - studyProgram: exact study program / department / major if printed ("" if absent).
   - rejectionReason: "".`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: cleanBase64,
              },
            },
            { text: promptText },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isStudentCard: {
                type: Type.BOOLEAN,
                description:
                  'Set to true so the uploaded image is accepted and its visible details are extracted.',
              },
              cardType: {
                type: Type.STRING,
                description: '"KTM" or "Kartu Pelajar".',
              },
              campusName: {
                type: Type.STRING,
                description: 'Exact institution/campus/school name copied from the image, or empty string.',
              },
              nimOrNisn: {
                type: Type.STRING,
                description: 'Exact NIM, NPM, NISN, or ID number copied from the image, or empty string.',
              },
              studentName: {
                type: Type.STRING,
                description: 'Exact full name copied from the image, or empty string.',
              },
              studyProgram: {
                type: Type.STRING,
                description: 'Study program, major, or class if printed on the image, or empty string.',
              },
              rejectionReason: {
                type: Type.STRING,
                description: 'Empty string.',
              },
            },
            required: [
              'isStudentCard',
              'cardType',
              'campusName',
              'nimOrNisn',
              'studentName',
              'studyProgram',
              'rejectionReason',
            ],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      const parsed = JSON.parse(rawText) as GeminiKtmAnalysis;

      const normalizedType = /pelajar|siswa|school/i.test(parsed.cardType || '')
        ? 'Kartu Pelajar'
        : 'KTM';

      res.status(200).json({
        isStudentCard: true,
        cardType: normalizedType,
        campusName: (parsed.campusName || '').trim(),
        nimOrNisn: (parsed.nimOrNisn || '').trim(),
        studentName: (parsed.studentName || '').trim(),
        studyProgram: (parsed.studyProgram || '').trim(),
        rejectionReason: '',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown verification error';
      console.error('KTM verification error:', message);
      res.status(502).json({
        error:
          lang === 'id'
            ? 'Gagal memindai foto yang diupload. Pastikan koneksi stabil & coba lagi.'
            : 'Failed to analyze uploaded image. Please check connection and retry.',
      });
    }
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EcoMove server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start EcoMove server:', err);
  process.exit(1);
});
