export interface QrModelWindows {
  id?: string;
  deviceID?: string;
  createdAt?: string;
  userUuid?: string;
  videoUrl?: string;
  youtubeId?: string;
  videoID?: string;
  subtitle?: string;
  videoName?: string;
  videoModel?: {
    hlsVideo?: string;
    hls_video?: string;
    webmVideo?: string;
    webm_video?: string;
    youtube_url?: string;
    title?: string;
    subtitle?: string;
  };
  videoQualitiesHLS?: any[];
  videoQualitiesVideoAndAudio?: any[];
}

/**
 * Mirrors Flutter `SeenVideoModel`. v2 fields (`maxPercent`,
 * `totalWatchSeconds`, `lastWatchedAt`) are written by the new client; older
 * entries may only have `timeFinish` / `entryCounter`.
 */
export interface VideoProgress {
  entryCounter?: number;
  timeFinish?: string[];
  subtitle?: string;
  // v2 tracking
  maxPercent?: number;
  totalWatchSeconds?: number;
  lastWatchedAt?: unknown; // Firestore Timestamp on the server side
}

export interface StudentData {
  seenVideos: {
    [videoID: string]: VideoProgress;
  };
}

export interface WindowsVersion {
  version: string;
  downloadUrl: string;
  forceUpdate: boolean;
}

export interface AppConfig {
  primaryColor: string;
  initializeFirebase: () => void;
  watchedOffline: boolean;
  nameAdmin: string;
  baseUrl: string;
  usingApi: boolean;
  logo?: string; // Path to logo image
  backgroundImage?: string; // Path to background image
  version?: string; // App version
  videoStreamBaseUrl?: string; // Base URL for video-stream server (e.g. https://videostream.nexwavetec.com)
  videoStreamToken?: string; // Auth token for video-stream API
} 