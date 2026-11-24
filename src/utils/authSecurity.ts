import type { UserProfile } from '../types/ecomove';

export interface PasswordCriteriaResult {
  minLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
  noSpaces: boolean;
  notContainsEmail: boolean;
  score: number; // 0 to 5
  isValid: boolean;
}

export interface StoredAccountRecord {
  profile: UserProfile;
  passwordSalt?: string;
  passwordHash?: string;
  updatedAt: number;
}

const ACCOUNTS_STORAGE_KEY_V2 = 'ecomove_registered_accounts_v2';
const LEGACY_STORAGE_KEY_V1 = 'ecomove_registered_accounts_v1';

export function isGmailAddress(email: string): boolean {
  return /^[^\s@]+@(gmail\.com|googlemail\.com)$/i.test(email.trim());
}

export function isValidEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function evaluatePasswordCriteria(
  password: string,
  emailOrIdentifier = ''
): PasswordCriteriaResult {
  const minLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9\s]/.test(password);
  const noSpaces = password.length > 0 && !/\s/.test(password);

  const cleanId = emailOrIdentifier.trim().toLowerCase();
  const localPart = cleanId.includes('@') ? cleanId.split('@')[0] : cleanId;
  const notContainsEmail =
    localPart.length < 3 || !password.toLowerCase().includes(localPart);

  const score = [minLength, hasUpper, hasLower, hasNumber, hasSymbol].filter(Boolean).length;
  const isValid =
    minLength &&
    hasUpper &&
    hasLower &&
    hasNumber &&
    hasSymbol &&
    noSpaces &&
    notContainsEmail;

  return {
    minLength,
    hasUpper,
    hasLower,
    hasNumber,
    hasSymbol,
    noSpaces,
    notContainsEmail,
    score,
    isValid,
  };
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateSaltHex(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytesToHex(bytes);
}

export async function hashPassword(
  password: string,
  existingSalt?: string
): Promise<{ salt: string; hash: string }> {
  const salt = existingSalt || generateSaltHex();

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: encoder.encode(salt),
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );
    return {
      salt,
      hash: bytesToHex(new Uint8Array(derivedBits)),
    };
  }

  // Fallback for environments without Web Crypto Subtle
  let h1 = 0x811c9dc5;
  const combined = `${salt}:${password}`;
  for (let i = 0; i < combined.length; i++) {
    h1 ^= combined.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
  }
  return {
    salt,
    hash: `fb-${(h1 >>> 0).toString(16)}`,
  };
}

export async function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string
): Promise<boolean> {
  if (!password || !salt || !expectedHash) return false;
  const { hash } = await hashPassword(password, salt);
  if (hash.length !== expectedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) {
    diff |= hash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }
  return diff === 0;
}

export function loadStoredAccounts(): Record<string, StoredAccountRecord> {
  try {
    const rawV2 = localStorage.getItem(ACCOUNTS_STORAGE_KEY_V2);
    const parsedV2: Record<string, StoredAccountRecord> = rawV2
      ? (JSON.parse(rawV2) as Record<string, StoredAccountRecord>)
      : {};

    // Migrate legacy v1 profiles without attaching any hardcoded password
    const rawV1 = localStorage.getItem(LEGACY_STORAGE_KEY_V1);
    if (rawV1) {
      const legacy = JSON.parse(rawV1) as Record<string, UserProfile>;
      let migrated = false;
      for (const [key, profile] of Object.entries(legacy)) {
        const normalizedKey = key.toLowerCase();
        if (!parsedV2[normalizedKey] && profile?.email) {
          parsedV2[normalizedKey] = {
            profile,
            updatedAt: Date.now(),
          };
          migrated = true;
        }
      }
      if (migrated) {
        localStorage.setItem(ACCOUNTS_STORAGE_KEY_V2, JSON.stringify(parsedV2));
      }
    }

    return parsedV2;
  } catch {
    return {};
  }
}

export function getStoredAccount(email: string): StoredAccountRecord | null {
  const key = email.trim().toLowerCase();
  if (!key) return null;
  const all = loadStoredAccounts();
  return all[key] ?? null;
}

export function saveStoredAccountRecord(record: StoredAccountRecord): void {
  try {
    const all = loadStoredAccounts();
    const key = record.profile.email.trim().toLowerCase();
    all[key] = {
      ...record,
      updatedAt: Date.now(),
    };
    localStorage.setItem(ACCOUNTS_STORAGE_KEY_V2, JSON.stringify(all));
  } catch {
    // Ignore storage quota errors
  }
}

export function updateStoredAccountProfile(profile: UserProfile): void {
  const existing = getStoredAccount(profile.email);
  saveStoredAccountRecord({
    profile,
    passwordSalt: existing?.passwordSalt,
    passwordHash: existing?.passwordHash,
    updatedAt: Date.now(),
  });
}
