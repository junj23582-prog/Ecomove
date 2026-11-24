import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

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

interface VercelReq {
  method?: string;
  body?: unknown;
}

interface VercelRes {
  status: (code: number) => VercelRes;
  json: (payload: unknown) => void;
  setHeader: (name: string, value: string) => void;
  end: () => void;
}

export default async function handler(req: VercelReq, res: VercelRes) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const rawBody =
    typeof req.body === 'string'
      ? (JSON.parse(req.body || '{}') as VerifyKtmBody)
      : ((req.body || {}) as VerifyKtmBody);

  const rawBase64 =
    typeof rawBody.imageBase64 === 'string' ? rawBody.imageBase64.trim() : '';
  const mimeType =
    typeof rawBody.mimeType === 'string' && rawBody.mimeType.startsWith('image/')
      ? rawBody.mimeType
      : 'image/jpeg';
  const lang = rawBody.lang === 'en' ? 'en' : 'id';

  if (!rawBase64) {
    res.status(400).json({
      error:
        lang === 'id'
          ? 'Gambar foto yang diupload tidak ditemukan.'
          : 'Uploaded image payload is missing.',
    });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    res.status(503).json({
      error:
        lang === 'id'
          ? 'GEMINI_API_KEY belum dikonfigurasi di environment server.'
          : 'GEMINI_API_KEY is not configured on the server.',
    });
    return;
  }

  const cleanBase64 = rawBase64.replace(
    /^data:image\/[a-zA-Z0-9+.-]+;base64,/,
    ''
  );

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const promptText =
    lang === 'id'
      ? `Anda adalah sistem OCR & deteksi dokumen EcoMove Indonesia.
Tugas Anda adalah mendeteksi dan mengekstrak keterangan dari gambar apa pun yang diunggah pengguna pada fitur Upload Foto KTM / Kartu Pelajar:
1. DETEKSI UNIVERSAL: Setel isStudentCard = true untuk setiap gambar yang diunggah agar proses upload selalu terdeteksi, baik itu foto KTM fisik, Kartu Pelajar, tangkapan layar kartu digital, foto buram/miring, maupun foto lainnya.
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
      model: 'gemini-3.1-flash-lite',
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
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
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
              description:
                'Exact institution/campus/school name copied from the image, or empty string.',
            },
            nimOrNisn: {
              type: Type.STRING,
              description:
                'Exact NIM, NPM, NISN, or ID number copied from the image, or empty string.',
            },
            studentName: {
              type: Type.STRING,
              description:
                'Exact full name copied from the image, or empty string.',
            },
            studyProgram: {
              type: Type.STRING,
              description:
                'Study program, major, or class if printed on the image, or empty string.',
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

    const rawText = (response.text ?? '')
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    const parsed = JSON.parse(rawText || '{}') as GeminiKtmAnalysis;

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
    const message =
      err instanceof Error ? err.message : 'Unknown verification error';
    console.error('Vercel KTM verification error:', message);
    res.status(502).json({
      error:
        lang === 'id'
          ? 'Gagal memindai foto via server. Beralih ke OCR lokal.'
          : 'Server scan failed. Falling back to local OCR.',
    });
  }
}
