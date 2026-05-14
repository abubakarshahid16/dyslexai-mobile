import AsyncStorage from '@react-native-async-storage/async-storage';
import { createStudent, type StudentResponse } from '../api/exercises';

const STORAGE_KEY_PREFIX = '@dyslexai/exercise_student';

function storageKey(userId: number | string): string {
  return `${STORAGE_KEY_PREFIX}_${String(userId)}`;
}

/** Get stored exercise-backend student ID for this auth user (or guest). */
export async function getStoredStudentId(userId: number | string): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const data = JSON.parse(raw) as { id: string };
    return data?.id ?? null;
  } catch {
    return null;
  }
}

/** Clear stored student so next getOrCreateStudent will create a new one (e.g. after backend DB reset or 404). */
export async function clearStoredStudent(userId: number | string): Promise<void> {
  await AsyncStorage.removeItem(storageKey(userId));
}

export async function setStoredStudent(userId: number | string, student: StudentResponse): Promise<void> {
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify({ id: student.id, name: student.name }));
}

/** Get or create an exercise-backend student for this auth user. Progress is per-user. */
export async function getOrCreateStudent(
  userId: number | string,
  name: string = 'Learner',
  age: number = 10
): Promise<string> {
  const existing = await getStoredStudentId(userId);
  if (existing) return existing;
  const student = await createStudent(name, age);
  await setStoredStudent(userId, student);
  return student.id;
}
