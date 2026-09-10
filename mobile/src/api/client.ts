import { API_BASE_URL } from '../config';
import { withTimeout } from '../extractor';
import type { Video } from '../types';

export interface SearchResponse {
  videos: Video[];
}

/**
 * Search using the on-device engine first (bundled yt-dlp); fall back to
 * the hosted API when the native module is unavailable (Expo Go / web).
 * Timeouts are enforced so the UI can never spin on "searching" forever.
 */
export async function searchVideos(query: string): Promise<Video[]> {
  try {
    const { default: native, isSoundWaveNativeAvailable } = await import('soundwave-native');
    if (native?.search && isSoundWaveNativeAvailable()) {
      return await withTimeout(native.search(query), 90_000, 'Search');
    }
  } catch {
    // native unavailable or timed out — fall through to API
  }

  const url = `${API_BASE_URL}/api/search?q=${encodeURIComponent(query)}`;
  const response = await withTimeout(fetch(url), 25_000, 'Search');
  if (!response.ok) {
    throw new Error(`Search failed (HTTP ${response.status})`);
  }
  const data = (await response.json()) as SearchResponse;
  return data.videos || [];
}