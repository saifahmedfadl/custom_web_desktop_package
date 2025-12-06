export interface VideoProgress {
  progress: number;
  videoId: string;
  timestamp: number;
}

export interface VideoThresholds {
  fivePercent: boolean;
  twentyPercent: boolean;
  twentyFivePercent: boolean;
  fortyPercent: boolean;
  sixtyPercent: boolean;
  eightyPercent: boolean;
  ninetyFivePercent: boolean;
}

export interface VideoState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  progress: number;
  loading: boolean;
  error: string | null;
  thresholds: VideoThresholds;
} 