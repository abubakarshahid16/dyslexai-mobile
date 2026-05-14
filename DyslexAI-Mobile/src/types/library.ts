import type { ScanResultPayload } from './navigation';

export type SavedScan = ScanResultPayload & {
  id: string;
  savedAt: number;
};

export const LIBRARY_STORAGE_KEY = '@dyslexai/saved_scans';
