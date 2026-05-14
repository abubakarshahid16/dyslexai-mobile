import { EXERCISE_API_BASE_URL } from '../constants/config';

export type GameTodayResponse = {
  day: { day_number: number; phase_number: number; title: string };
  progress: {
    current_day: number;
    streak: number;
    last_completed_date?: string | null;
  };
  exercises: Array<{
    id: number;
    order_in_day: number;
    exercise_type: string;
    content: any;
  }>;
};

export type GameProgressResponse = {
  progress: {
    current_day: number;
    streak: number;
    last_completed_date?: string | null;
  };
  completions: Array<{
    day_number: number;
    completed_at?: string | null;
    score: number;
    puzzle_piece_earned: boolean;
    phase_number: number;
  }>;
};

export type GamePuzzleResponse = {
  phase: number;
  day_range: [number, number];
  pieces_earned: number[];
  pieces_total: number;
};

export type GameCompleteDayResponse = {
  completed: boolean;
  already_completed?: boolean;
  day_number: number;
  score: number;
  puzzle_piece_earned: boolean;
  next_day?: number;
  streak?: number;
};

const REQUEST_TIMEOUT_MS = 90 * 1000;

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
      let message = text || `Game API error: ${res.status}`;
      try {
        const j = JSON.parse(text) as { detail?: string };
        if (j?.detail) message = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail);
      } catch {
        // keep raw text
      }
      throw new Error(message);
    }

    return res.json() as Promise<T>;
  } catch (e) {
    clearTimeout(timeoutId);
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Game server took too long to respond (timeout).');
    }
    if (isNetworkError(e)) {
      throw new Error('Cannot reach the game backend (port 8001).');
    }
    throw e;
  }
}

export async function getGameToday(studentId: string): Promise<GameTodayResponse> {
  const q = `?student_id=${encodeURIComponent(studentId)}`;
  return request<GameTodayResponse>(`/api/game/today${q}`);
}

export async function completeGameDay(payload: {
  studentId: string;
  dayNumber: number;
  exerciseScores: number[];
}): Promise<GameCompleteDayResponse> {
  return request<GameCompleteDayResponse>('/api/game/complete-day', {
    method: 'POST',
    body: JSON.stringify({
      student_id: payload.studentId,
      day_number: payload.dayNumber,
      exercise_scores: payload.exerciseScores,
    }),
  });
}

export async function getGameProgress(studentId: string): Promise<GameProgressResponse> {
  const q = `?student_id=${encodeURIComponent(studentId)}`;
  return request<GameProgressResponse>(`/api/game/progress${q}`);
}

export async function getGamePuzzle(phase: number, studentId: string): Promise<GamePuzzleResponse> {
  const q = `?student_id=${encodeURIComponent(studentId)}`;
  return request<GamePuzzleResponse>(`/api/game/puzzle/${encodeURIComponent(String(phase))}${q}`);
}

