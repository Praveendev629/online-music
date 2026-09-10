export type SearchResult = {
  id: string;
  title: string;
  author: string;
  thumbnail: string;
  duration: string;
  views: string;
};

export type SoundWaveModuleEvents = Record<string, never>;