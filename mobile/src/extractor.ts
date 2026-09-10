import { API_BASE_URL } from './config';

/**
 * On-device extraction (bundled yt-dlp via the Kotlin module) is preferred.
 * When the module is absent (Expo Go / web / unlinked builds) the app falls
 * back to the hosted API server.
 */
async function getNativeModule(): Promise<any> {
  try {
    const { default: native, isSoundWaveNativeAvailable } = await import('soundwave-native');
    return native?.extractAudio && isSoundWaveNativeAvailable() ? native : null;
  } catch {
    return null;
  }
}

export const hasNativeExtractor = async (): Promise<boolean> =>
  (await getNativeModule()) != null;

export async function getStreamUrl(videoId: string): Promise<string> {
  const native = await getNativeModule();
  if (native) {
    return native.extractAudio(videoId);
  }
  return `${API_BASE_URL}/api/stream/${videoId}`;
}

export async function getDownloadUrl(videoId: string, title: string): Promise<string> {
  const native = await getNativeModule();
  if (native) {
    return native.extractAudio(videoId);
  }
  return `${API_BASE_URL}/api/download/${videoId}?title=${encodeURIComponent(title)}`;
}