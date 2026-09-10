import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { SearchResult, SoundWaveModuleEvents } from './SoundWave.types';

declare class SoundWaveModule extends NativeModule<SoundWaveModuleEvents> {
  extractAudio(videoId: string): Promise<string>;
  search(query: string): Promise<SearchResult[]>;
}

// `soundwave-native` is only present in dev/native builds that bundle the
// Kotlin module (e.g. an EAS/`expo run:android` build). In Expo Go this
// resolves to null so the app safely falls back to the hosted API.
const nativeModule = requireOptionalNativeModule<SoundWaveModule | null>('SoundWave');

export function isSoundWaveNativeAvailable(): boolean {
  return nativeModule != null;
}

export default nativeModule;