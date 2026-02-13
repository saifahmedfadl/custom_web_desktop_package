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

// Analytics types matching ns_player and video-stream backend schema
export type AnalyticsEventType =
  | 'session_start'
  | 'session_end'
  | 'video_open'
  | 'view_start'
  | 'view_progress'
  | 'view_complete'
  | 'buffer_start'
  | 'buffer_end'
  | 'quality_change'
  | 'seek'
  | 'pause'
  | 'resume'
  | 'error';

export type QualityChangeReason = 'user' | 'auto' | 'policy';
export type PlayerSource = 'app' | 'web' | 'admin';
export type PlaybackPurpose = 'stream' | 'download';

export interface AnalyticsEvent {
  eventType: AnalyticsEventType;
  videoId: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export interface ServerAnalyticsConfig {
  analyticsEnabled: boolean;
  level: 'full' | 'sampling' | 'high_load' | 'critical';
  samplingRate: number;
  progressIntervalMs: number;
}

export interface QualityLevel {
  height: number;
  bitrate: number;
  index: number;
  fileSize?: number;
  codec?: string;
  audioCodec?: string;
  fps?: number;
} 