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
    webmVideo?: string;
  };
  videoQualitiesHLS?: any[];
  videoQualitiesVideoAndAudio?: any[];
}

export interface VideoProgress {
  entryCounter: number;
  timeFinish: string[];
  subtitle: string;
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