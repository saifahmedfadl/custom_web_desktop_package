import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { QrModelWindows } from '../models/QrModel';
import { VideoState, VideoThresholds } from '../models/VideoModel';
import { apiService } from '../services/api';
import { firebaseService } from '../services/firebase';

const initialThresholds: VideoThresholds = {
  fivePercent: false,
  twentyPercent: false,
  twentyFivePercent: false,
  fortyPercent: false,
  sixtyPercent: false,
  eightyPercent: false,
  ninetyFivePercent: false,
};

// Flush to server at most once per 2 minutes while watching — mirrors the
// Flutter VideoController `_saveInterval` so the desktop and mobile clients
// have the same write cadence and Firestore write-amplification profile.
const SAVE_INTERVAL_MS = 2 * 60 * 1000;

// Wait this long before we count the open as a real "view" and bump
// `entryCounter`. Same number as Flutter `increaseEntryCounter` (4 min),
// so the teacher dashboard sees consistent counts across both clients.
const ENTRY_COUNTER_DELAY_MS = 4 * 60 * 1000;

// Build the legacy `timeFinish` checkpoint array (every 5%) so any teacher UI
// still reading that field keeps working. Same logic as Flutter `_flushProgress`.
const buildLegacyThresholds = (maxPercent: number): string[] => {
  const out: string[] = [];
  for (let t = 0; t <= 100; t += 5) {
    if (maxPercent >= t) out.push(t.toString());
  }
  return out;
};

export const useVideoProgress = (videoData: QrModelWindows | null) => {
  const { config } = useApp();
  const [videoState, setVideoState] = useState<VideoState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    progress: 0,
    loading: true,
    error: null,
    thresholds: { ...initialThresholds },
  });

  // ===================== PROGRESS TRACKING (local) =====================
  // These mirror the Flutter VideoController fields:
  //   _maxPercentReached, _totalWatchSeconds, _lastTrackedPosition,
  //   _lastTickWallTime, _hasUnsavedProgress, _saveTimer.
  // We track in refs (not state) because every tick must be cheap and must
  // not trigger React re-renders — only the periodic flush touches Firestore.
  const maxPercentRef = useRef<number>(0);
  const totalWatchSecondsRef = useRef<number>(0);
  const lastTrackedPositionRef = useRef<number | null>(null);
  const lastTickWallTimeRef = useRef<number | null>(null);
  const hasUnsavedProgressRef = useRef<boolean>(false);
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flushInFlightRef = useRef<boolean>(false);

  // Persist the latest videoData/config in refs so the unmount flush still
  // has the right userUuid/videoId even after React tears down state.
  const videoDataRef = useRef(videoData);
  const configRef = useRef(config);
  useEffect(() => { videoDataRef.current = videoData; }, [videoData]);
  useEffect(() => { configRef.current = config; }, [config]);

  /**
   * Writes accumulated progress to Firestore (or the API) if anything changed.
   * Safe to call repeatedly; no-op when nothing is dirty. Mirrors the Flutter
   * `_flushProgress` method including the optimistic dirty-flag clear and
   * re-queue on failure.
   */
  const flushProgress = useCallback(async () => {
    if (!hasUnsavedProgressRef.current) return;
    if (flushInFlightRef.current) return;

    const data = videoDataRef.current;
    const cfg = configRef.current;
    if (!data?.videoID || !data?.userUuid) return;

    // Optimistically clear the flag so concurrent tick updates aren't lost
    // if the write fails (we re-set it in catch).
    hasUnsavedProgressRef.current = false;
    flushInFlightRef.current = true;

    const maxPercent = maxPercentRef.current;
    const totalWatchSeconds = totalWatchSecondsRef.current;
    const legacyThresholds = buildLegacyThresholds(maxPercent);

    try {
      if (cfg?.usingApi) {
        await apiService.updateVideoProgress(
          data.userUuid,
          data.videoID,
          data.subtitle || '',
          maxPercent,
          totalWatchSeconds,
          legacyThresholds,
        );
      } else {
        await firebaseService.updateVideoProgress(
          data.userUuid,
          data.videoID,
          data.subtitle || '',
          maxPercent,
          totalWatchSeconds,
          legacyThresholds,
        );
      }
    } catch (error) {
      // Re-queue so the next tick retries this write.
      hasUnsavedProgressRef.current = true;
      console.error('Error saving video progress', error);
    } finally {
      flushInFlightRef.current = false;
    }
  }, []);

  /**
   * Starts the periodic flush timer. Idempotent — safe to call on every tick.
   * Mirrors Flutter `_ensureSaveTimerRunning`.
   */
  const ensureSaveTimerRunning = useCallback(() => {
    if (saveTimerRef.current) return;
    saveTimerRef.current = setInterval(() => {
      void flushProgress();
    }, SAVE_INTERVAL_MS);
  }, [flushProgress]);

  /**
   * Central progress sink. Called from every player listener (HLS, YouTube,
   * <video> timeupdate). Intentionally cheap: only updates in-memory state.
   * The periodic save timer is the single writer that commits to Firestore.
   *
   * Direct port of Flutter `handleVideoProgressCommon`.
   */
  const updateProgress = useCallback((currentTime: number, duration: number) => {
    if (!duration || duration <= 0) return;

    ensureSaveTimerRunning();

    // Accumulate *real* watch time. We only count seconds where the
    // position advanced at a natural rate (roughly real time). This
    // excludes pauses, seeks forward, and rewinds.
    const now = Date.now();
    const lastPos = lastTrackedPositionRef.current;
    const lastWall = lastTickWallTimeRef.current;
    if (lastPos !== null && lastWall !== null) {
      const posDeltaMs = (currentTime - lastPos) * 1000;
      const wallDeltaMs = now - lastWall;

      // Normal playback delta: position advanced between 200ms and 2s,
      // and matches wall-clock progress within 1 second (allowing buffering).
      const isNormalPlayback =
        posDeltaMs > 200 &&
        posDeltaMs <= 2000 &&
        Math.abs(posDeltaMs - wallDeltaMs) < 1000;

      if (isNormalPlayback) {
        const addedSeconds = Math.floor(posDeltaMs / 1000);
        if (addedSeconds > 0) {
          totalWatchSecondsRef.current += addedSeconds;
          hasUnsavedProgressRef.current = true;
        }
      }
    }
    lastTrackedPositionRef.current = currentTime;
    lastTickWallTimeRef.current = now;

    // Track furthest point reached (independent of watch time so seek-ahead
    // still moves the ceiling but does not inflate actual watch seconds).
    const progress = (currentTime / duration) * 100;
    const percent = Math.max(0, Math.min(100, Math.floor(progress)));
    if (percent > maxPercentRef.current) {
      maxPercentRef.current = percent;
      hasUnsavedProgressRef.current = true;
    }

    // Update lightweight UI state (currentTime/duration/progress).
    // We avoid re-rendering for every tick by skipping if nothing visible
    // changed at the integer-second level.
    setVideoState(prev => {
      const newThresholds = { ...prev.thresholds };
      if (progress >= 5) newThresholds.fivePercent = true;
      if (progress >= 20) newThresholds.twentyPercent = true;
      if (progress >= 25) newThresholds.twentyFivePercent = true;
      if (progress >= 40) newThresholds.fortyPercent = true;
      if (progress >= 60) newThresholds.sixtyPercent = true;
      if (progress >= 80) newThresholds.eightyPercent = true;
      if (progress >= 95) newThresholds.ninetyFivePercent = true;

      return {
        ...prev,
        currentTime,
        duration,
        progress,
        thresholds: newThresholds,
      };
    });
  }, [ensureSaveTimerRunning]);

  /**
   * Legacy entry point for callers that only know the watched fraction
   * (0.0–1.0 or 0–100). Updates the local tracker directly since there is
   * no meaningful duration. Mirrors Flutter `handleVideoProgress`.
   */
  const updateProgressByFraction = useCallback((percentWatched: number) => {
    ensureSaveTimerRunning();
    const pct = percentWatched <= 1.0
      ? Math.round(percentWatched * 100)
      : Math.round(percentWatched);
    const clamped = Math.max(0, Math.min(100, pct));
    if (clamped > maxPercentRef.current) {
      maxPercentRef.current = clamped;
      hasUnsavedProgressRef.current = true;
    }
  }, [ensureSaveTimerRunning]);

  const setPlaying = useCallback((isPlaying: boolean) => {
    setVideoState(prev => ({ ...prev, isPlaying }));
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setVideoState(prev => ({ ...prev, loading }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setVideoState(prev => ({ ...prev, error }));
  }, []);

  const resetProgress = useCallback(() => {
    maxPercentRef.current = 0;
    totalWatchSecondsRef.current = 0;
    lastTrackedPositionRef.current = null;
    lastTickWallTimeRef.current = null;
    hasUnsavedProgressRef.current = false;
    setVideoState({
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      progress: 0,
      loading: true,
      error: null,
      thresholds: { ...initialThresholds },
    });
  }, []);

  // ===================== first-watch entry seed =====================
  // Mirrors Flutter `checkFirstOne`: when a student opens a video for the
  // first time, seed the seenVideos entry with the full set of fields
  // (idVideo, titleVideo, subtitle, time, timeFinish:['0']) so teacher-side
  // aggregation queries (`where('seenVideos.<id>.idVideo', isEqualTo: id)`)
  // can find the entry. Without this, the first writer is the periodic
  // `_flushProgress` which only sets maxPercent/totalWatchSeconds and the
  // entry shows up missing `idVideo`/`titleVideo`.
  useEffect(() => {
    if (!videoData?.videoID || !videoData?.userUuid) return;
    const userUuid = videoData.userUuid;
    const videoId = videoData.videoID;
    const videoTitle =
      videoData.videoName ||
      videoData.videoModel?.title ||
      '';
    const subtitle =
      videoData.subtitle ||
      videoData.videoModel?.subtitle ||
      '';
    const usingApi = config?.usingApi === true;

    if (usingApi) {
      void apiService.ensureVideoEntry(userUuid, videoId, videoTitle, subtitle);
    } else {
      void firebaseService.ensureVideoEntry(userUuid, videoId, videoTitle, subtitle);
    }
  }, [videoData?.videoID, videoData?.userUuid, config?.usingApi]);

  // ===================== entryCounter (session-start signal) =====================
  // Mirrors Flutter `increaseEntryCounter`: schedule a single timer 4 min
  // after the video opens; if the student is still on the page when it
  // fires, bump `seenVideos.<videoId>.entryCounter`. Cancelled on unmount.
  useEffect(() => {
    if (!videoData?.videoID || !videoData?.userUuid) return;
    const userUuid = videoData.userUuid;
    const videoId = videoData.videoID;
    const usingApi = config?.usingApi === true;

    const timer = setTimeout(() => {
      if (usingApi) {
        void apiService.incrementVideoEntryCounter(userUuid, videoId);
      } else {
        void firebaseService.incrementVideoEntryCounter(userUuid, videoId);
      }
    }, ENTRY_COUNTER_DELAY_MS);

    return () => clearTimeout(timer);
  }, [videoData?.videoID, videoData?.userUuid, config?.usingApi]);

  // Stop the periodic timer and flush any pending progress on unmount or
  // when the videoData target changes. This mirrors Flutter's GetX `onClose`
  // which cancels the save timer and fires a final flush so we don't lose
  // the last ~2 minutes of watch time.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearInterval(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      void flushProgress();
    };
  }, [flushProgress]);

  // Flush before the page is closed/refreshed so we don't lose the tail.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => { void flushProgress(); };
    window.addEventListener('beforeunload', handler);
    window.addEventListener('pagehide', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
      window.removeEventListener('pagehide', handler);
    };
  }, [flushProgress]);

  // ===================== iframe postMessage adapter =====================
  // The videostream / YouTube iframes are opaque to React; the only way to
  // get position events out is `window.postMessage`. We forward any message
  // we recognise into the same `updateProgress` sink the direct callers use,
  // so all tracking logic lives in one place.
  //
  // Origin allow-list — both players we host:
  //   - https://videostream.nexwavetec.com (HLS player, sends
  //       `{source:'video-stream-player', type:'progress', currentTime, duration}`)
  //   - https://youtube-iframe-pi.vercel.app (YouTube embed, sends
  //       `{event:'stateChange', state:{currentTime, duration, ...}}` as a
  //       JSON-encoded string)
  // Any extra origins from `config.videoStreamBaseUrl` are added at runtime
  // so a custom deployment doesn't get silently dropped.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const allowedOrigins = new Set<string>([
      'https://videostream.nexwavetec.com',
      'https://youtube-iframe-pi.vercel.app',
    ]);
    try {
      const cfgUrl = config?.videoStreamBaseUrl;
      if (cfgUrl) allowedOrigins.add(new URL(cfgUrl).origin);
    } catch { /* ignore malformed config URL */ }

    const onMessage = (ev: MessageEvent) => {
      // Origin filter — we only trust messages from our own player frames.
      // `ev.origin` is a string like 'https://host:port' (no trailing slash),
      // so we compare against the set above.
      if (!allowedOrigins.has(ev.origin)) return;

      // Both players send strings (JSON-encoded); the desktop hook accepts
      // either a parsed object or a JSON string.
      let data: any = ev.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch { return; }
      }
      if (!data || typeof data !== 'object') return;

      // YouTube embed shape: `{ event: 'stateChange', state: { currentTime, duration } }`
      if (data.event === 'stateChange' && data.state && typeof data.state === 'object') {
        const ct = Number(data.state.currentTime);
        const dur = Number(data.state.duration);
        if (Number.isFinite(ct) && Number.isFinite(dur) && dur > 0) {
          updateProgress(ct, dur);
        }
        return;
      }

      // Generic / video-stream-player shape:
      //   { type: 'progress', currentTime, duration }
      //   { event: 'timeupdate', currentTime, duration }
      //   { kind: 'progress', position, duration }
      const type = (data.type || data.event || data.kind || '').toString();
      if (!type) return;

      if (type === 'progress' || type === 'timeupdate' || type === 'view_progress') {
        const currentTime = Number(data.currentTime ?? data.position ?? data.time);
        const duration = Number(data.duration ?? data.length);
        if (Number.isFinite(currentTime) && Number.isFinite(duration) && duration > 0) {
          updateProgress(currentTime, duration);
        }
      } else if (type === 'fraction' || type === 'percent') {
        const pct = Number(data.value ?? data.percent ?? data.fraction);
        if (Number.isFinite(pct)) updateProgressByFraction(pct);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [updateProgress, updateProgressByFraction, config?.videoStreamBaseUrl]);

  return {
    videoState,
    updateProgress,
    updateProgressByFraction,
    flushProgress,
    setPlaying,
    setLoading,
    setError,
    resetProgress,
  };
};
