/**
 * Exercise backend API (dyslexia-backend).
 * Flow: createStudent → getNextExercise → startSession → submitAnswer → repeat.
 */
import { EXERCISE_API_BASE_URL } from '../constants/config';

// --- Types (match dyslexia-backend schemas) ---

export type StudentResponse = {
  id: string;
  name: string;
  age: number;
  difficulty_level: number;
  total_sessions: number;
  streak_days: number;
};

export type ExerciseResponse = {
  id: string;
  type?: string;
  content: string;
  expected: string;
  target_words: string[];
  difficulty: number;
  age_group: string;
  source: string;
};

export type SubmitResponse = {
  session_id: string;
  score: number;
  char_errors?: Array<{ position: number; expected_char: string; actual_char: string; error_type: string }>;
  phonetic_score?: number;
  feedback: string;
  new_difficulty_level: number;
  words_updated: string[];
  ocr_text?: string;
  ocr_confidence?: number;
  stroke_errors?: Array<{ letter: string; accuracy: number }>;
  trace_score?: number;
};

/** Exercise types from backend: word_typing, sentence_typing, handwriting, tracing */
export const EXERCISE_TYPES = {
  WORD_TYPING: 'word_typing',
  SENTENCE_TYPING: 'sentence_typing',
  HANDWRITING: 'handwriting',
  TRACING: 'tracing',
} as const;

export type StudentStats = {
  student_id: string;
  student_name: string;
  current_difficulty: number;
  total_sessions: number;
  average_score: number;
  score_trend: number[];
  words_mastered: string[];
  words_struggling: string[];
  total_words_practiced: number;
  top_confusion_pairs: Array<{ pattern: string; count: number }>;
  accuracy_by_type: Record<string, number>;
};

export type StudentSessionHistoryItem = {
  session_id: string;
  submitted_at?: string | null;
  score: number;
  trace_score?: number | null;
  duration_seconds?: number | null;
  exercise_id?: string | null;
  exercise_type?: string | null;
  exercise_content?: string | null;
};

// --- API calls ---

const REQUEST_TIMEOUT_MS = 90 * 1000; // 90s – allow slow backend/DB (was 25s and broke loading)

function isNetworkError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /network|failed to fetch|connection|ECONNREFUSED|ETIMEDOUT/i.test(msg);
}

import { getToken } from '../utils/authStorage';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${EXERCISE_API_BASE_URL}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const token = await getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as any) || {}),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers,
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      const text = await res.text();
      let message = text || `Exercise API error: ${res.status}`;
      try {
        const j = JSON.parse(text) as { detail?: string };
        if (j?.detail) message = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail);
      } catch {
        /* use raw text */
      }
      throw new Error(message);
    }
    return res.json() as Promise<T>;
  } catch (e) {
    clearTimeout(timeoutId);
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(
        'Exercise server took too long. Check: (1) Exercise backend is running on port 8001. (2) App URL is correct (emulator: 10.0.2.2:8001). (3) Firewall allows port 8001.'
      );
    }
    if (isNetworkError(e)) {
      throw new Error(
        'Cannot reach the exercise server. Check that the exercise backend is running on port 8001 and that the app can reach your PC (see NETWORK_FIX.md).'
      );
    }
    throw e;
  }
}

/** Create a student (call once, then store student_id). */
export async function createStudent(name: string, age: number): Promise<StudentResponse> {
  return request<StudentResponse>('/students/', {
    method: 'POST',
    body: JSON.stringify({ name, age }),
  });
}

/** Get next adaptive exercise for this student. Optional type filter and avoid_exercise_id (e.g. just completed) so the same exercise is not returned twice in a row. */
export async function getNextExercise(
  studentId: string,
  type?: string,
  avoidExerciseId?: string
): Promise<ExerciseResponse> {
  const id = typeof studentId === 'string' ? studentId : (studentId as { id?: string })?.id ?? '';
  let path = `/exercises/next?student_id=${encodeURIComponent(id)}`;
  if (type && ([EXERCISE_TYPES.WORD_TYPING, EXERCISE_TYPES.SENTENCE_TYPING, EXERCISE_TYPES.HANDWRITING, EXERCISE_TYPES.TRACING] as string[]).includes(type)) {
    path += `&type=${encodeURIComponent(type)}`;
  }
  if (avoidExerciseId) {
    path += `&avoid_exercise_id=${encodeURIComponent(avoidExerciseId)}`;
  }
  return request<ExerciseResponse>(path);
}

/** Start a session (call after student sees the exercise, before they submit). */
export async function startSession(
  studentId: string,
  exerciseId: string,
  isHandwriting: boolean = false
): Promise<{ session_id: string; expected: string }> {
  return request<{ session_id: string; expected: string }>('/sessions/', {
    method: 'POST',
    body: JSON.stringify({
      student_id: studentId,
      exercise_id: exerciseId,
      is_handwriting: isHandwriting,
    }),
  });
}

/** Submit typed answer (word_typing / sentence_typing). */
export async function submitAnswer(
  sessionId: string,
  studentResponse: string,
  durationSeconds?: number,
  ocrConfidence?: number
): Promise<SubmitResponse> {
  return request<SubmitResponse>(`/sessions/${sessionId}/submit`, {
    method: 'POST',
    body: JSON.stringify({
      student_response: studentResponse,
      duration_seconds: durationSeconds ?? undefined,
      ocr_confidence: ocrConfidence ?? undefined,
    }),
  });
}

/** Submit handwriting image (handwriting exercises). Backend runs OCR and scores. */
export async function submitHandwriting(
  sessionId: string,
  imageUri: string,
  durationSeconds?: number
): Promise<SubmitResponse> {
  const formData = new FormData();
  // @ts-ignore - React Native FormData accepts { uri, type, name }
  formData.append('file', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'handwriting.jpg',
  });
  if (durationSeconds != null) {
    formData.append('duration_seconds', String(durationSeconds));
  }
  const url = `${EXERCISE_API_BASE_URL}/sessions/${sessionId}/submit-handwriting`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const token = await getToken();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(url, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
      headers,
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Submit handwriting failed: ${res.status}`);
    }
    return res.json() as Promise<SubmitResponse>;
  } catch (e) {
    clearTimeout(timeoutId);
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Exercise server took too long. Check backend on port 8001.');
    }
    if (isNetworkError(e)) {
      throw new Error('Cannot reach the exercise server. See NETWORK_FIX.md.');
    }
    throw e;
  }
}

/** Submit tracing result (tracing exercises). Frontend computes trace_score; backend stores and returns feedback. */
export async function submitTracing(
  sessionId: string,
  traceScore: number,
  durationSeconds: number,
  strokeErrors?: Array<{ letter: string; accuracy: number }>
): Promise<SubmitResponse> {
  return request<SubmitResponse>(`/sessions/${sessionId}/submit-tracing`, {
    method: 'POST',
    body: JSON.stringify({
      trace_score: traceScore,
      duration_seconds: durationSeconds,
      stroke_errors: strokeErrors ?? [],
    }),
  });
}

/** Generate new AI exercises for this student. Optional type filter. */
export async function generateExercises(
  studentId: string,
  type?: string
): Promise<{ message: string; generated: number; exercises?: Array<{ type: string; content: string; target_words: string[] }> }> {
  let path = `/exercises/generate?student_id=${encodeURIComponent(studentId)}`;
  if (type && ([EXERCISE_TYPES.WORD_TYPING, EXERCISE_TYPES.SENTENCE_TYPING, EXERCISE_TYPES.HANDWRITING, EXERCISE_TYPES.TRACING] as string[]).includes(type)) {
    path += `&type=${encodeURIComponent(type)}`;
  }
  return request(path, { method: 'POST' });
}

/** Get full progress report for dashboard. */
export async function getStudentStats(studentId: string): Promise<StudentStats> {
  return request<StudentStats>(`/students/${studentId}/stats`);
}

/** Get user session history with exercise-level details. */
export async function getStudentSessionHistory(
  studentId: string,
  options: { limit?: number; type?: string } = {}
): Promise<StudentSessionHistoryItem[]> {
  const q: string[] = [];
  if (options.limit != null) q.push(`limit=${encodeURIComponent(String(options.limit))}`);
  if (options.type) q.push(`type=${encodeURIComponent(options.type)}`);
  const qs = q.length ? `?${q.join('&')}` : '';
  try {
    return await request<StudentSessionHistoryItem[]>(`/students/${studentId}/sessions${qs}`);
  } catch (firstErr) {
    // Backward-compatible fallback for backends exposing history under /history
    try {
      return await request<StudentSessionHistoryItem[]>(`/students/${studentId}/history${qs}`);
    } catch (secondErr) {
      const firstMsg = firstErr instanceof Error ? firstErr.message : String(firstErr);
      const secondMsg = secondErr instanceof Error ? secondErr.message : String(secondErr);
      // If neither route exists yet, keep app functional (history can be hidden/fallback).
      if (/404|not found/i.test(firstMsg) && /404|not found/i.test(secondMsg)) {
        return [];
      }
      throw secondErr;
    }
  }
}
