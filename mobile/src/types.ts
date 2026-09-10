export interface Video {
  id: string;
  title: string;
  author: string;
  thumbnail: string;
  duration: string;
  views: string;
}

export interface DownloadedTrack {
  id: string;
  title: string;
  author: string;
  localUri: string;
}