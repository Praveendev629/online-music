import { API_BASE_URL } from '../config';
import type { Video } from '../types';

export interface SearchResponse {
  videos: Video[];
}

/**
 * Search using the on-device engine first (bundled yt-dlp); fall back to
 * the hosted API when the native module is unavailable (Expo Go / web).
 */
export async function searchVideos(query: string): Promise<Video[]> {
  try {
    const { default: native, isSoundWaveNativeAvailable } = await import('soundwave-native');
    if (native?.search && isSoundWaveNativeAvailable()) {
      return await native.search(query);
    }
  } catch {
    // native module not linked — fall through to API
  }

  const url = `${API_BASE_URL}/api/search?q=${encodeURIComponent(query)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Search failed (HTTP ${response.status})`);
  }
  const data = (await response.json()) as SearchResponse;
  return data.videos || [];
}