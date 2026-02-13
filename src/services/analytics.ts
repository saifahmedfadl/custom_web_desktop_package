/**
 * Video Analytics Service
 * TypeScript port matching ns_player (Flutter) analytics logic and video-stream analytics-plugin.js
 *
 * Features:
 * - Event batching (max 50 events or 30 seconds)
 * - Quality change tracking with preference persistence
 * - Resume point storage (every 10 seconds)
 * - Bandwidth estimation
 * - Error reporting
 * - Session management with device fingerprinting
 * - Server config fetching (analytics level, sampling)
 * - Offline queue with retry
 */

import type {
  AnalyticsEvent,
  AnalyticsEventType,
  PlaybackPurpose,
  PlayerSource,
  QualityChangeReason,
  ServerAnalyticsConfig,
} from '../models/VideoModel';

// Configuration constants
const CONFIG = {
  maxBatchSize: 50,
  batchIntervalMs: 30000,
  resumePointIntervalMs: 10000,
  qualityPrefKey: 'preferred_quality',
  resumePointPrefix: 'resume_point_',
  pendingEventsKey: 'pending_analytics_events',
  fingerprintKey: 'device_fingerprint',
  maxPendingEvents: 500,
};

const DEFAULT_SERVER_CONFIG: ServerAnalyticsConfig = {
  analyticsEnabled: true,
  level: 'full',
  samplingRate: 1.0,
  progressIntervalMs: 10000,
};

class VideoAnalyticsService {
  // State
  private baseUrl: string = '';
  private authToken: string = '';
  private videoId: string = '';
  private sessionId: string = '';
  private userId: string | null = null;
  private fingerprint: string = '';
  private source: PlayerSource = 'web';
  private purpose: PlaybackPurpose = 'stream';
  private isEnabled: boolean = true;

  // Server configuration
  private serverConfig: ServerAnalyticsConfig = { ...DEFAULT_SERVER_CONFIG };

  // Bandwidth tracking
  private totalBandwidthBytes: number = 0;

  // Event buffer
  private eventBuffer: AnalyticsEvent[] = [];
  private batchTimer: ReturnType<typeof setInterval> | null = null;
  private resumePointTimer: ReturnType<typeof setInterval> | null = null;

  // Current video state
  private currentPosition: number = 0;
  private totalWatched: number = 0;
  private lastQuality: string | null = null;
  private bufferStartTime: number | null = null;

  /**
   * Initialize the analytics service
   */
  async initialize(options: {
    baseUrl: string;
    authToken?: string;
    videoId: string;
    userId?: string;
    source?: PlayerSource;
    purpose?: PlaybackPurpose;
  }): Promise<void> {
    this.baseUrl = options.baseUrl;
    this.authToken = options.authToken || '';
    this.videoId = options.videoId;
    this.userId = options.userId || null;
    this.source = options.source || 'web';
    this.purpose = options.purpose || 'stream';
    this.sessionId = this.generateSessionId();

    // Don't track analytics for admin preview
    this.isEnabled = this.source !== 'admin';

    // Load or generate device fingerprint
    this.fingerprint = this.loadOrGenerateFingerprint();

    // Load pending events from storage
    await this.loadPendingEvents();

    // Start batch timer
    this.startBatchTimer();

    // Fetch server configuration
    await this.fetchServerConfig();

    console.log('[AnalyticsService] Initialized:', {
      videoId: this.videoId,
      sessionId: this.sessionId,
      enabled: this.isEnabled,
      fingerprint: this.fingerprint,
      level: this.serverConfig.level,
    });
  }

  /**
   * Update auth token
   */
  updateAuthToken(token: string | null): void {
    this.authToken = token || '';
  }

  /**
   * Update playback purpose
   */
  updatePurpose(purpose: PlaybackPurpose): void {
    if (this.purpose !== purpose) {
      console.log(`[AnalyticsService] Updating purpose to: ${purpose}`);
      this.purpose = purpose;
    }
  }

  /**
   * Get server config (for progress interval)
   */
  getServerConfig(): ServerAnalyticsConfig {
    return this.serverConfig;
  }

  // ==================== Video Tracking ====================

  /**
   * Start tracking a video
   */
  startVideoTracking(videoId?: string): void {
    if (!this.isEnabled) return;

    if (videoId) this.videoId = videoId;
    this.currentPosition = 0;
    this.totalWatched = 0;
    this.totalBandwidthBytes = 0;
    this.sessionId = this.generateSessionId();

    // Track session start
    this.trackEvent('session_start', {
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      screenWidth: typeof window !== 'undefined' ? window.innerWidth : 0,
      screenHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
    });

    // Track view start
    this.trackEvent('view_start', { position: 0 });

    // Start resume point timer
    this.startResumePointTimer();
  }

  /**
   * Stop tracking current video
   */
  stopVideoTracking(finalPosition?: number, completionPct?: number): void {
    if (!this.isEnabled) return;

    // Track session end with bandwidth
    this.trackEvent('session_end', {
      position: finalPosition ?? this.currentPosition,
      totalWatched: this.totalWatched,
      completionPct,
      bandwidthBytes: this.totalBandwidthBytes,
    });

    // Save resume point
    if (finalPosition != null && finalPosition > 0) {
      this.saveResumePoint(finalPosition);
    }

    // Flush remaining events
    this.flushEvents();

    // Stop timers
    if (this.resumePointTimer) {
      clearInterval(this.resumePointTimer);
      this.resumePointTimer = null;
    }
  }

  // ==================== Event Tracking ====================

  /**
   * Track an analytics event
   */
  trackEvent(eventType: AnalyticsEventType, data: Record<string, unknown> = {}): void {
    if (!this.isEnabled) return;

    // Check server config for event filtering
    if (!this.shouldProcessEvent(eventType)) return;

    const event: AnalyticsEvent = {
      eventType,
      videoId: this.videoId,
      timestamp: new Date().toISOString(),
      data,
    };

    this.eventBuffer.push(event);

    // Flush if buffer is full
    if (this.eventBuffer.length >= CONFIG.maxBatchSize) {
      this.flushEvents();
    }
  }

  /**
   * Track view progress
   */
  trackProgress(
    position: number,
    duration: number,
    quality?: string | null,
    bandwidth?: number,
    playbackSpeed: number = 1,
  ): void {
    if (!this.isEnabled) return;

    this.currentPosition = position;
    this.totalWatched = Math.max(this.totalWatched, position);

    // Track bandwidth
    if (bandwidth && bandwidth > 0) {
      this.totalBandwidthBytes += bandwidth;
    }

    this.trackEvent('view_progress', {
      position,
      duration,
      ...(quality && { quality }),
      ...(bandwidth && { bandwidth }),
      playbackSpeed,
      totalWatched: this.totalWatched,
    });
  }

  /**
   * Track seek event
   */
  trackSeek(fromPosition: number, toPosition: number): void {
    if (!this.isEnabled) return;

    this.trackEvent('seek', {
      fromPosition,
      toPosition,
      position: toPosition,
    });
  }

  /**
   * Track quality change
   */
  trackQualityChange(
    fromQuality: string,
    toQuality: string,
    reason: QualityChangeReason = 'user',
  ): void {
    if (!this.isEnabled) return;

    this.trackEvent('quality_change', {
      fromQuality,
      toQuality,
      qualityChangeReason: reason,
    });

    this.lastQuality = toQuality;

    // Save preferred quality if user selected it
    if (reason === 'user') {
      this.savePreferredQuality(toQuality);
    }
  }

  /**
   * Track pause
   */
  trackPause(position?: number): void {
    if (!this.isEnabled) return;

    this.trackEvent('pause', {
      position: position ?? this.currentPosition,
      totalWatched: this.totalWatched,
    });

    // Flush events on pause
    this.flushEvents();
  }

  /**
   * Track resume/play
   */
  trackResume(position?: number): void {
    if (!this.isEnabled) return;

    this.trackEvent('resume', {
      position: position ?? this.currentPosition,
    });
  }

  /**
   * Track buffering start
   */
  trackBufferStart(position?: number, quality?: string | null): void {
    if (!this.isEnabled) return;

    this.bufferStartTime = Date.now();
    this.trackEvent('buffer_start', {
      position: position ?? this.currentPosition,
      ...(quality && { quality }),
    });
  }

  /**
   * Track buffering end
   */
  trackBufferEnd(quality?: string | null): void {
    if (!this.isEnabled) return;

    const duration = this.bufferStartTime ? (Date.now() - this.bufferStartTime) / 1000 : 0;
    this.trackEvent('buffer_end', {
      bufferDuration: duration,
      ...(quality && { quality }),
    });
    this.bufferStartTime = null;
  }

  /**
   * Track video complete
   */
  trackComplete(duration: number): void {
    if (!this.isEnabled) return;

    this.trackEvent('view_complete', {
      duration,
      totalWatched: this.totalWatched,
      completionPct: 100,
    });

    // Flush events on complete
    this.flushEvents();
  }

  /**
   * Track error
   */
  trackError(errorMessage: string, errorCode?: string | null, position?: number): void {
    if (!this.isEnabled) return;

    this.trackEvent('error', {
      errorMessage,
      ...(errorCode && { errorCode }),
      position: position ?? this.currentPosition,
    });

    // Flush immediately on error
    this.flushEvents();
  }

  // ==================== Quality Preference ====================

  /**
   * Save preferred quality
   */
  savePreferredQuality(quality: string): void {
    try {
      localStorage.setItem(CONFIG.qualityPrefKey, quality);
      console.log(`[AnalyticsService] Saved preferred quality: ${quality}`);
    } catch {
      // Silently fail if localStorage is blocked
    }
  }

  /**
   * Get preferred quality
   */
  getPreferredQuality(): string | null {
    try {
      return localStorage.getItem(CONFIG.qualityPrefKey);
    } catch {
      return null;
    }
  }

  /**
   * Get best available quality based on preference
   */
  getBestAvailableQuality(preferred: string | null, availableQualities: string[]): string | null {
    if (availableQualities.length === 0) return null;
    if (!preferred) return availableQualities[0];

    const qualityOrder = ['4k', '1440p', '1080p', '720p', '480p', '360p'];
    const preferredIndex = qualityOrder.indexOf(preferred.toLowerCase());
    if (preferredIndex === -1) return availableQualities[0];

    // Try to find preferred or lower quality
    for (let i = preferredIndex; i < qualityOrder.length; i++) {
      const quality = qualityOrder[i];
      const match = availableQualities.find((q) =>
        q.toLowerCase().includes(quality.replace('p', '')),
      );
      if (match) return match;
    }

    return availableQualities[0];
  }

  // ==================== Resume Point ====================

  /**
   * Save resume point to local storage
   */
  saveResumePoint(position: number): void {
    if (!this.videoId) return;
    const key = `${CONFIG.resumePointPrefix}${this.videoId}`;
    try {
      localStorage.setItem(key, position.toString());
    } catch {
      // Silently fail
    }
  }

  /**
   * Get resume point from local storage
   */
  getResumePoint(videoId?: string): number {
    const id = videoId || this.videoId;
    if (!id) return 0;
    const key = `${CONFIG.resumePointPrefix}${id}`;
    try {
      const point = localStorage.getItem(key);
      return point ? parseFloat(point) : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Clear resume point (when video is completed)
   */
  clearResumePoint(videoId?: string): void {
    const id = videoId || this.videoId;
    if (!id) return;
    const key = `${CONFIG.resumePointPrefix}${id}`;
    try {
      localStorage.removeItem(key);
    } catch {
      // Silently fail
    }
  }

  // ==================== Private Methods ====================

  /**
   * Load or generate device fingerprint
   */
  private loadOrGenerateFingerprint(): string {
    try {
      let fp = localStorage.getItem(CONFIG.fingerprintKey);
      if (!fp) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 9);
        fp = `fp_web_${timestamp}_${random}`;
        localStorage.setItem(CONFIG.fingerprintKey, fp);
        console.log(`[AnalyticsService] Generated new fingerprint: ${fp}`);
      }
      return fp;
    } catch {
      return `fp_session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
  }

  /**
   * Fetch analytics configuration from server
   */
  private async fetchServerConfig(): Promise<void> {
    if (!this.baseUrl) return;

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/analytics/client-config`, {
        headers: {
          'Content-Type': 'application/json',
          ...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
        },
      });

      if (response.ok) {
        const json = await response.json();
        if (json.success && json.data) {
          this.serverConfig = {
            analyticsEnabled: json.data.analyticsEnabled ?? true,
            level: json.data.level ?? 'full',
            samplingRate: json.data.samplingRate ?? 1.0,
            progressIntervalMs: json.data.progressIntervalMs ?? 10000,
          };
          this.isEnabled = this.serverConfig.analyticsEnabled && this.source !== 'admin';
          console.log('[AnalyticsService] Server config loaded:', this.serverConfig);
        }
      }
    } catch (error) {
      console.warn('[AnalyticsService] Failed to fetch server config:', error);
      // Continue with defaults
    }
  }

  /**
   * Check if event should be processed based on level and sampling
   */
  private shouldProcessEvent(eventType: AnalyticsEventType): boolean {
    if (!this.isEnabled || !this.serverConfig.analyticsEnabled) return false;

    const { level, samplingRate } = this.serverConfig;

    switch (level) {
      case 'critical':
        return false;

      case 'high_load':
        if (
          ['buffer_start', 'buffer_end', 'quality_change', 'seek', 'view_progress'].includes(
            eventType,
          )
        ) {
          return false;
        }
        return true;

      case 'sampling':
        if (eventType === 'quality_change') return true;
        if (['view_progress', 'buffer_start', 'buffer_end'].includes(eventType)) {
          return Math.random() < samplingRate;
        }
        return true;

      case 'full':
      default:
        return true;
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Start batch timer
   */
  private startBatchTimer(): void {
    if (this.batchTimer) clearInterval(this.batchTimer);
    this.batchTimer = setInterval(() => this.flushEvents(), CONFIG.batchIntervalMs);
  }

  /**
   * Start resume point timer
   */
  private startResumePointTimer(): void {
    if (this.resumePointTimer) clearInterval(this.resumePointTimer);
    this.resumePointTimer = setInterval(() => {
      if (this.currentPosition > 0) {
        this.saveResumePoint(this.currentPosition);
      }
    }, CONFIG.resumePointIntervalMs);
  }

  /**
   * Flush events to server
   */
  private async flushEvents(): Promise<void> {
    if (this.eventBuffer.length === 0 || !this.baseUrl) return;

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    try {
      await this.sendEvents(events);
    } catch (error) {
      console.error('[AnalyticsService] Failed to send events:', error);
      // Store events for retry
      this.savePendingEvents(events);
    }
  }

  /**
   * Send events to server
   */
  private async sendEvents(events: AnalyticsEvent[]): Promise<void> {
    if (events.length === 0 || !this.baseUrl) return;

    const idempotencyKey = `batch_${Date.now()}_${events.length}`;

    const payload = {
      sessionId: this.sessionId,
      userId: this.userId,
      fingerprint: this.fingerprint,
      idempotencyKey,
      source: this.source,
      purpose: this.purpose,
      events,
    };

    const response = await fetch(`${this.baseUrl}/api/v1/analytics/events/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.authToken && {
          Authorization: `Bearer ${this.authToken}`,
          'Account-ID': this.authToken,
        }),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    console.log(
      `[AnalyticsService] Sent ${events.length} events with idempotencyKey: ${idempotencyKey}`,
    );
  }

  /**
   * Save pending events to localStorage for retry
   */
  private savePendingEvents(events: AnalyticsEvent[]): void {
    try {
      const existing = JSON.parse(localStorage.getItem(CONFIG.pendingEventsKey) || '[]');
      const combined = [...existing, ...events.map((e) => JSON.stringify(e))];
      const limited =
        combined.length > CONFIG.maxPendingEvents
          ? combined.slice(combined.length - CONFIG.maxPendingEvents)
          : combined;
      localStorage.setItem(CONFIG.pendingEventsKey, JSON.stringify(limited));
      console.log(
        `[AnalyticsService] Saved ${events.length} events to offline queue (total: ${limited.length})`,
      );
    } catch {
      console.warn('[AnalyticsService] Failed to save pending events');
    }
  }

  /**
   * Load and resend pending events from offline queue
   */
  private async loadPendingEvents(): Promise<void> {
    try {
      const pendingStr = localStorage.getItem(CONFIG.pendingEventsKey);
      if (!pendingStr) return;

      const pending: string[] = JSON.parse(pendingStr);
      if (!pending.length) return;

      console.log(`[AnalyticsService] Found ${pending.length} pending events in offline queue`);

      const eventsToSend: AnalyticsEvent[] = [];
      for (const jsonStr of pending) {
        try {
          const event = JSON.parse(jsonStr) as AnalyticsEvent;
          if (event.eventType && event.videoId) {
            eventsToSend.push(event);
          }
        } catch {
          // Skip invalid events
        }
      }

      if (eventsToSend.length === 0) {
        localStorage.removeItem(CONFIG.pendingEventsKey);
        return;
      }

      // Send in batches of 50
      let allSent = true;
      for (let i = 0; i < eventsToSend.length; i += CONFIG.maxBatchSize) {
        const batch = eventsToSend.slice(i, i + CONFIG.maxBatchSize);
        try {
          await this.sendEvents(batch);
          console.log(`[AnalyticsService] Sent ${batch.length} pending events`);
        } catch {
          allSent = false;
          const remaining = eventsToSend.slice(i);
          this.savePendingEvents(remaining);
          break;
        }
      }

      if (allSent) {
        localStorage.removeItem(CONFIG.pendingEventsKey);
        console.log('[AnalyticsService] Cleared offline queue - all events sent');
      }
    } catch {
      console.warn('[AnalyticsService] Failed to load pending events');
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.stopVideoTracking(this.currentPosition);
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
    if (this.resumePointTimer) {
      clearInterval(this.resumePointTimer);
      this.resumePointTimer = null;
    }
  }
}

// Singleton instance
export const analyticsService = new VideoAnalyticsService();
export { VideoAnalyticsService };
