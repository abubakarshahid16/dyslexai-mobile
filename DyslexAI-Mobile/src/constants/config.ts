/**
 * Scan backend (DocTR + TrOCR) — port 8000.
 * Set in .env: emulator = 10.0.2.2, physical device = your PC's IP (e.g. 192.168.1.12).
 */
const scanBase = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8000';
export const API_BASE_URL = scanBase;

/**
 * Exercise backend (practice exercises) — port 8001.
 * If EXPO_PUBLIC_EXERCISE_API_URL is not set, use same host as scan backend (so one .env URL works for both).
 */
function sameHostPort8001(): string {
  try {
    const u = new URL(scanBase);
    return `${u.protocol}//${u.hostname}:8001`;
  } catch {
    return 'http://10.0.2.2:8001';
  }
}
export const EXERCISE_API_BASE_URL =
  process.env.EXPO_PUBLIC_EXERCISE_API_URL ?? sameHostPort8001();
