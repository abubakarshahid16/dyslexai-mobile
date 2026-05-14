import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ScanResultPayload } from '../types/navigation';
import type { SavedScan } from '../types/library';
import { LIBRARY_STORAGE_KEY } from '../types/library';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export async function saveScanResult(payload: ScanResultPayload): Promise<SavedScan> {
  const saved: SavedScan = {
    ...payload,
    id: generateId(),
    savedAt: Date.now(),
  };
  const list = await getSavedScans();
  list.unshift(saved);
  await AsyncStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(list));
  return saved;
}

export async function getSavedScans(): Promise<SavedScan[]> {
  try {
    const raw = await AsyncStorage.getItem(LIBRARY_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as SavedScan[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function deleteSavedScan(id: string): Promise<void> {
  const list = await getSavedScans();
  const next = list.filter((s) => s.id !== id);
  await AsyncStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(next));
}

export async function isScanSaved(payload: ScanResultPayload): Promise<boolean> {
  const list = await getSavedScans();
  const match = list.find(
    (s) =>
      s.correctedText === payload.correctedText &&
      Math.abs(s.savedAt - Date.now()) < 60000
  );
  return !!match;
}
