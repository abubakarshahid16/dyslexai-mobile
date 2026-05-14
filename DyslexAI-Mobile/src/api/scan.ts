import { API_BASE_URL } from '../constants/config';
import { getToken } from '../utils/authStorage';

export type ErrorRegion = {
  bbox: [number, number, number, number]; // [x_min, y_min, x_max, y_max] in image pixels
  original?: string;
  corrected?: string;
};

export type ScanResponse = {
  raw_text: string;
  cleaned_text: string;
  corrected_text: string;
  line_count: number;
  lines: Array<{ line_number: number; text: string }>;
  image_width?: number;
  image_height?: number;
  error_regions?: ErrorRegion[];
};

/**
 * Upload a handwriting image to the backend.
 * Uses the same /ocr/process API as the web app.
 */
const SCAN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

function isNetworkError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /network|failed to fetch|connection|ECONNREFUSED|ETIMEDOUT/i.test(msg);
}

export async function scanImage(imageUri: string): Promise<ScanResponse> {
  const formData = new FormData();
  // @ts-ignore - React Native FormData accepts { uri, type, name }
  formData.append('file', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'handwriting.jpg',
  });
  formData.append('quality_mode', 'high');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);

  try {
    const token = await getToken();
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/scan`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
      headers,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || `Scan failed: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      raw_text: data.raw_text || '',
      cleaned_text: data.corrected_text || data.raw_text || '',
      corrected_text: data.corrected_text || data.raw_text || '',
      line_count: data.line_count || 0,
      lines: (data.lines || []).map((l: any, idx: number) => ({
        line_number: idx + 1,
        text: l.corrected_text || l.raw_text || ''
      })),
      image_width: data.metadata?.image_width || 1,
      image_height: data.metadata?.image_height || 1,
      error_regions: data.error_regions || [],
    };
  } catch (e) {
    clearTimeout(timeoutId);
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(
        'Scan timed out (5 min). Use a smaller image or check that the scan backend is running.'
      );
    }
    if (isNetworkError(e)) {
      throw new Error(
        'Cannot reach the scan server. Check: (1) Backend is running. (2) App URL is correct (emulator: 10.0.2.2:8000). (3) Firewall allows port 8000.'
      );
    }
    throw e;
  }
}
