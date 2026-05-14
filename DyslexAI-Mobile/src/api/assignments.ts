import { EXERCISE_API_BASE_URL } from '../constants/config';

export type AssignmentExerciseType = 'word_typing' | 'sentence_typing' | 'handwriting' | 'tracing';

export type AssignmentCustomExercise = {
  type: AssignmentExerciseType;
  content: string;
  expected: string;
  target_words?: string[];
  difficulty?: number;
};

export type AssignmentGenerateSpec = {
  type: AssignmentExerciseType;
  words?: string[];
  difficulty?: number;
  student_age?: number;
  count?: number;
};

export type AssignmentCreatePayload = {
  teacherId: number;
  studentId?: string | null; // UUID string; null/undefined => template (unassigned)
  title: string;
  description?: string | null;
  dueAt?: string | null; // ISO
  mode: 'custom' | 'generate';
  customExercises?: AssignmentCustomExercise[];
  generate?: AssignmentGenerateSpec;
};

export type AssignmentListItem = {
  id: number;
  student_id: string | null;
  student_name?: string | null;
  title: string;
  description?: string | null;
  due_at?: string | null;
  created_at?: string | null;
  exercise_count: number;
  completed_sessions: number;
  completed_exercises: number;
  types: string[];
  avg_score?: number | null;
};

export type AssignmentDetailExercise = {
  id: string;
  type: AssignmentExerciseType | string;
  content: string;
  expected: string;
  target_words: string[];
  difficulty: number;
  completed: boolean;
  attempts: number;
  last_result?: {
    score: number;
    student_response: string | null;
    submitted_at?: string | null;
  } | null;
};

export type AssignmentDetail = {
  id: number;
  student_id: string | null;
  title: string;
  description?: string | null;
  due_at?: string | null;
  created_at?: string | null;
  exercises: AssignmentDetailExercise[];
};

export type ListAssignmentsParams = {
  teacherId?: number;
  studentId?: string; // UUID string
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
      let message = text || `Assignments API error: ${res.status}`;
      try {
        const j = JSON.parse(text) as { detail?: string };
        if (j?.detail) message = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail);
      } catch {
        // use raw
      }
      throw new Error(message);
    }
    return res.json() as Promise<T>;
  } catch (e) {
    clearTimeout(timeoutId);
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Assignments server took too long to respond (timeout).');
    }
    if (isNetworkError(e)) {
      throw new Error('Cannot reach assignments backend (port 8001).');
    }
    throw e;
  }
}

export async function createAssignment(payload: AssignmentCreatePayload): Promise<{ id: number }> {
  const body = {
    teacher_id: payload.teacherId,
    student_id: payload.studentId ?? null,
    title: payload.title,
    description: payload.description ?? null,
    due_at: payload.dueAt ?? null,
    mode: payload.mode,
    custom_exercises: payload.customExercises ?? [],
    generate: payload.generate ?? null,
  };

  return request<{ id: number }>('/assignments', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function assignAssignment(payload: { assignmentId: number; teacherId: number; studentId: string }): Promise<{ assigned: boolean }> {
  return request<{ assigned: boolean }>(`/assignments/${encodeURIComponent(String(payload.assignmentId))}/assign`, {
    method: 'POST',
    body: JSON.stringify({ teacher_id: payload.teacherId, student_id: payload.studentId }),
  });
}

export async function listAssignments(params: ListAssignmentsParams = {}): Promise<AssignmentListItem[]> {
  const q: string[] = [];
  if (params.teacherId != null) q.push(`teacher_id=${encodeURIComponent(String(params.teacherId))}`);
  if (params.studentId) q.push(`student_id=${encodeURIComponent(params.studentId)}`);
  const qs = q.length ? `?${q.join('&')}` : '';
  return request<AssignmentListItem[]>(`/assignments${qs}`, { method: 'GET' });
}

export async function getAssignment(assignmentId: number): Promise<AssignmentDetail> {
  return request<AssignmentDetail>(`/assignments/${encodeURIComponent(String(assignmentId))}`, { method: 'GET' });
}

export type TeacherStudent = {
  id: string;
  name: string;
  age?: number | null;
};

export type TeacherCombinedProgressResponse = {
  avg_score: number | null;
  total_sessions: number;
  students: Array<{
    student_id: string;
    student_name: string;
    age?: number | null;
    total_sessions: number;
    avg_score: number | null;
  }>;
};

export async function listTeacherStudents(params: { teacherId: number }): Promise<TeacherStudent[]> {
  return request<TeacherStudent[]>(`/assignments/meta/students?teacher_id=${encodeURIComponent(String(params.teacherId))}`, { method: 'GET' });
}

export async function getTeacherCombinedProgress(params: { teacherId: number }): Promise<TeacherCombinedProgressResponse> {
  return request<TeacherCombinedProgressResponse>(
    `/assignments/meta/progress/combined?teacher_id=${encodeURIComponent(String(params.teacherId))}`,
    { method: 'GET' }
  );
}

