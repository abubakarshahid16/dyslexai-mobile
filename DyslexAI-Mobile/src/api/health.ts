/**
 * Backend connectivity check (from the app's perspective).
 * Use to verify scan and exercise backends are reachable before testing features.
 */
import { API_BASE_URL, EXERCISE_API_BASE_URL } from '../constants/config';

const CHECK_TIMEOUT_MS = 10000;

export type BackendStatus = {
  scan: boolean;
  exercise: boolean;
  exerciseDb?: boolean; // true if /health/db returned ok and exercises_seeded
}

async function fetchWithTimeout(url: string): Promise<Response | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  try {
    const r = await fetch(url, { method: 'GET', signal: controller.signal });
    clearTimeout(timeoutId);
    return r;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

/** Check if the scan backend (port 8000) is reachable. */
export async function checkScanBackend(): Promise<boolean> {
  const r = await fetchWithTimeout(`${API_BASE_URL}/health`);
  return r != null && r.ok;
}

/** Check if the exercise backend (port 8001) is reachable and DB is ready. */
export async function checkExerciseBackend(): Promise<boolean> {
  const r = await fetchWithTimeout(`${EXERCISE_API_BASE_URL}/`);
  return r != null && r.ok;
}

/** Check both backends. If exercise server is up, also check DB via /health/db. 404 = old backend (leave exerciseDb undefined). */
export async function checkBackends(): Promise<BackendStatus> {
  const [scan, exerciseRes] = await Promise.all([
    checkScanBackend(),
    fetchWithTimeout(`${EXERCISE_API_BASE_URL}/`),
  ]);
  const exercise = exerciseRes != null && exerciseRes.ok;
  let exerciseDb: boolean | undefined;
  if (exercise) {
    const dbRes = await fetchWithTimeout(`${EXERCISE_API_BASE_URL}/health/db`);
    if (dbRes != null && dbRes.status !== 404) {
      if (dbRes.ok) {
        try {
          const j = await dbRes.json() as { status?: string; exercises_seeded?: boolean };
          exerciseDb = j.status === 'ok' && j.exercises_seeded === true;
        } catch {
          exerciseDb = false;
        }
      } else {
        exerciseDb = false; // 503 or other error = DB not ready
      }
    }
    // 404 = old backend without /health/db → leave exerciseDb undefined
  }
  return { scan, exercise, exerciseDb };
}
