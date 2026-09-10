import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import type { DownloadedTrack } from './types';

const LIKES_KEY = 'soundwave/likes';
const DOWNLOADS_KEY = 'soundwave/downloads';

export async function getLikes(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(LIKES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export async function saveLikes(likes: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(LIKES_KEY, JSON.stringify(likes));
  } catch {
    // ignore storage failures
  }
}

export async function getDownloads(): Promise<DownloadedTrack[]> {
  try {
    const raw = await AsyncStorage.getItem(DOWNLOADS_KEY);
    return raw ? (JSON.parse(raw) as DownloadedTrack[]) : [];
  } catch {
    return [];
  }
}

async function saveDownloads(tracks: DownloadedTrack[]): Promise<void> {
  try {
    await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(tracks));
  } catch {
    // ignore storage failures
  }
}

const downloadsDir = `${FileSystem.documentDirectory}downloads/`;

export async function ensureDownloadsDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(downloadsDir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(downloadsDir, { intermediates: true });
  }
}

export async function downloadTrack(
  id: string,
  title: string,
  author: string,
  sourceUrl: string
): Promise<DownloadedTrack> {
  await ensureDownloadsDir();
  const ext = sourceUrl.includes('.webm') || sourceUrl.includes('webm') ? '.webm' : '.m4a';
  const localUri = `${downloadsDir}${id}${ext}`;
  await FileSystem.downloadAsync(sourceUrl, localUri);

  const track: DownloadedTrack = { id, title, author, localUri };
  const existing = await getDownloads();
  const next = [track, ...existing.filter(t => t.id !== id)];
  await saveDownloads(next);
  return track;
}

export async function removeDownload(id: string): Promise<void> {
  try {
    const existing = await getDownloads();
    const track = existing.find(t => t.id === id);
    if (track) {
      await FileSystem.deleteAsync(track.localUri, { idempotent: true });
    }
    await saveDownloads(existing.filter(t => t.id !== id));
  } catch {
    // ignore cleanup failures
  }
}