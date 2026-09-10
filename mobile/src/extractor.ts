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

/**
 * Your signed-in YouTube session cookies (Netscape cookies.txt format) are read
 * from EXPO_PUBLIC_YOUTUBE_COOKIE (set via a local .env file or an EAS secret)
 * and handed to yt-dlp so extraction bypasses YouTube's bot checks.
 */
export async function configureNativeCookies(): Promise<void> {
  const native = await getNativeModule();
  if (native?.setCookies) {
    try {
      const cookies = process.env.EXPO_PUBLIC_YOUTUBE_COOKIE ?? '';
      await native.setCookies(cookies || null);
    } catch {
      // cookie setup is best-effort
    }
  }
}

/**
 * Kick off the expensive one-time initialization (extracting bundled Python +
 * yt-dlp and refreshing to the latest STABLE binary) right at app launch so it
 * never stalls your first search or playback.
 */
export async function warmUpNative(): Promise<void> {
  const native = await getNativeModule();
  if (native?.warmUp) {
    try {
      await native.warmUp();
    } catch {
      // warming up is non-critical
    }
  }
}

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