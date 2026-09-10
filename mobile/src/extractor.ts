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

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/**
 * Your signed-in YouTube session cookies (Netscape cookies.txt format) are read
 * from EXPO_PUBLIC_YOUTUBE_COOKIE (set via a local .env file or an EAS
 * environment variable) and handed to yt-dlp so extraction bypasses bot checks.
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
 * Kick off the cheap one-time init (extracting bundled Python + yt-dlp) right
 * at launch so the first search/playback is not slow. Downloads nothing.
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
    return withTimeout(native.extractAudio(videoId), 180_000, 'Audio extraction');
  }
  return `${API_BASE_URL}/api/stream/${videoId}`;
}

export async function getDownloadUrl(videoId: string, title: string): Promise<string> {
  const native = await getNativeModule();
  if (native) {
    return withTimeout(native.extractAudio(videoId), 180_000, 'Audio extraction');
  }
  return `${API_BASE_URL}/api/download/${videoId}?title=${encodeURIComponent(title)}`;
}