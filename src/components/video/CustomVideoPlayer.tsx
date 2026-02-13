import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { QualityLevel } from '../../models/VideoModel';
import { analyticsService } from '../../services/analytics';

interface CustomVideoPlayerProps {
  /** Video stream server base URL (e.g. https://videostream.nexwavetec.com) */
  videoStreamBaseUrl: string;
  /** Video ID in the video-stream system */
  videoId: string;
  /** Auth token for the video-stream API */
  authToken?: string;
  /** Direct HLS manifest URL (if available, skips fetching from server) */
  hlsUrl?: string;
  /** Poster/thumbnail URL */
  poster?: string;
  /** Auto play on load */
  autoplay?: boolean;
  /** Player source for analytics */
  source?: 'app' | 'web' | 'admin';
  /** Additional CSS class */
  className?: string;
  /** Callback when progress updates */
  onProgress?: (currentTime: number, duration: number, progressPct: number) => void;
  /** Callback when player state changes */
  onStateChange?: (state: 'playing' | 'paused' | 'buffering' | 'ended' | 'error') => void;
  /** Callback when player is ready */
  onReady?: (duration: number) => void;
  /** Callback on error */
  onError?: (error: string) => void;
}

interface VideoInfo {
  manifestUrl: string;
  thumbnailUrl?: string;
  qualities?: Array<{ quality: string; height: number }>;
}

const CustomVideoPlayer: React.FC<CustomVideoPlayerProps> = ({
  videoStreamBaseUrl,
  videoId,
  authToken,
  hlsUrl,
  poster,
  autoplay = false,
  source = 'web',
  className = '',
  onProgress,
  onStateChange,
  onReady,
  onError,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPositionRef = useRef<number>(0);
  const isBufferingRef = useRef<boolean>(false);

  const [qualities, setQualities] = useState<QualityLevel[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1); // -1 = auto
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [resumeTime, setResumeTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Custom controls state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Fetch video info from server
  const fetchVideoInfo = useCallback(async (): Promise<VideoInfo | null> => {
    if (hlsUrl) {
      return { manifestUrl: hlsUrl };
    }

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(
        `${videoStreamBaseUrl}/api/v1/videos/${videoId}/player-info`,
        { headers },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || 'Failed to fetch video info');
      }

      return {
        manifestUrl: result.data.masterPlaylistUrl,
        thumbnailUrl: result.data.thumbnailUrl,
        qualities: result.data.qualities,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to load video';
      console.error('[CustomVideoPlayer] fetchVideoInfo error:', msg);
      return null;
    }
  }, [videoStreamBaseUrl, videoId, authToken, hlsUrl]);

  // Initialize HLS.js and analytics
  useEffect(() => {
    let mounted = true;
    let Hls: any = null;

    const init = async () => {
      // Initialize analytics
      try {
        await analyticsService.initialize({
          baseUrl: videoStreamBaseUrl,
          authToken,
          videoId,
          source: source as 'app' | 'web' | 'admin',
        });
      } catch (e) {
        console.warn('[CustomVideoPlayer] Analytics init failed:', e);
      }

      // Fetch video info
      const videoInfo = await fetchVideoInfo();
      if (!mounted) return;

      if (!videoInfo || !videoInfo.manifestUrl) {
        const msg = 'Video not found or not ready';
        setErrorMsg(msg);
        setIsLoading(false);
        onError?.(msg);
        return;
      }

      const video = videoRef.current;
      if (!video) return;

      // Dynamically import hls.js
      try {
        const hlsModule = await import('hls.js');
        Hls = hlsModule.default || hlsModule;
      } catch {
        // hls.js not available, try native
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = videoInfo.manifestUrl;
          if (videoInfo.thumbnailUrl) video.poster = videoInfo.thumbnailUrl;
          setIsLoading(false);
          analyticsService.startVideoTracking(videoId);
          return;
        }
        const msg = 'HLS playback not supported in this browser';
        setErrorMsg(msg);
        setIsLoading(false);
        onError?.(msg);
        return;
      }

      if (!Hls.isSupported()) {
        // Try native HLS (Safari)
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = videoInfo.manifestUrl;
          if (videoInfo.thumbnailUrl) video.poster = videoInfo.thumbnailUrl;
          setIsLoading(false);
          analyticsService.startVideoTracking(videoId);
          return;
        }
        const msg = 'HLS not supported';
        setErrorMsg(msg);
        setIsLoading(false);
        onError?.(msg);
        return;
      }

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        startLevel: -1, // Auto
        capLevelToPlayerSize: true,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        maxBufferSize: 30 * 1000 * 1000,
        maxBufferHole: 0.5,
        backBufferLength: 30,
        startFragPrefetch: false,
      });

      hlsRef.current = hls;
      hls.loadSource(videoInfo.manifestUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_: any, data: any) => {
        if (!mounted) return;

        const levels: QualityLevel[] = data.levels.map((level: any, index: number) => ({
          height: level.height,
          bitrate: level.bitrate,
          index,
        }));
        levels.sort((a: QualityLevel, b: QualityLevel) => b.height - a.height);
        setQualities(levels);
        setIsLoading(false);

        // Apply preferred quality
        const preferred = analyticsService.getPreferredQuality();
        if (preferred) {
          const preferredHeight = parseInt(preferred.replace('p', ''));
          const levelIndex = hls.levels.findIndex((l: any) => l.height === preferredHeight);
          if (levelIndex !== -1) {
            hls.currentLevel = levelIndex;
            setCurrentQuality(preferredHeight);
          }
        }

        if (autoplay) {
          video.play().catch(() => {});
        }
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_: any, data: any) => {
        if (!mounted) return;
        const level = hls.levels[data.level];
        if (level) {
          setCurrentQuality(hls.autoLevelEnabled ? -1 : level.height);
        }
      });

      hls.on(Hls.Events.ERROR, (_: any, data: any) => {
        if (data.fatal) {
          console.error('[CustomVideoPlayer] HLS Error:', data);
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            const msg = `Playback error: ${data.details}`;
            setErrorMsg(msg);
            onError?.(msg);
            analyticsService.trackError(msg, data.details);
          }
        }
      });

      if (videoInfo.thumbnailUrl && !poster) {
        video.poster = videoInfo.thumbnailUrl;
      }

      // Start analytics tracking
      analyticsService.startVideoTracking(videoId);
    };

    init();

    return () => {
      mounted = false;
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      analyticsService.dispose();
    };
  }, [videoStreamBaseUrl, videoId, authToken, hlsUrl, source, autoplay, fetchVideoInfo, onError, poster]);

  // Handle resume point check after metadata loads
  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const dur = video.duration;
    setDuration(dur);
    onReady?.(dur);

    // Check for resume point
    const resumePt = analyticsService.getResumePoint(videoId);
    if (resumePt > 5 && resumePt < dur - 5) {
      setResumeTime(resumePt);
      setShowResumePrompt(true);
      // Auto dismiss after 10 seconds
      setTimeout(() => setShowResumePrompt(false), 10000);
    }
  }, [videoId, onReady]);

  // Resume from saved position
  const handleResume = useCallback(() => {
    const video = videoRef.current;
    if (video && resumeTime > 0) {
      video.currentTime = resumeTime;
      video.play().catch(() => {});
    }
    setShowResumePrompt(false);
  }, [resumeTime]);

  // Show/hide controls on mouse activity
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  }, [isPlaying]);

  const handleMouseMove = useCallback(() => {
    resetControlsTimeout();
  }, [resetControlsTimeout]);

  const handleMouseLeave = useCallback(() => {
    if (isPlaying) {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 1000);
    }
  }, [isPlaying]);

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(!video.muted ? false : true);
  }, []);

  // Handle volume change
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const val = parseFloat(e.target.value);
    video.volume = val;
    setVolume(val);
    if (val === 0) {
      video.muted = true;
      setIsMuted(true);
    } else if (video.muted) {
      video.muted = false;
      setIsMuted(false);
    }
  }, []);

  // Handle progress bar click/drag
  const handleProgressBarClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    const bar = progressBarRef.current;
    if (!video || !bar) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    video.currentTime = pct * video.duration;
  }, []);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen?.();
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Video event handlers
  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    analyticsService.trackResume();
    onStateChange?.('playing');
    startProgressTracking();
    resetControlsTimeout();
  }, [onStateChange, resetControlsTimeout]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    setShowControls(true);
    const video = videoRef.current;
    analyticsService.trackPause(video?.currentTime);
    onStateChange?.('paused');
    stopProgressTracking();
  }, [onStateChange]);

  const handleSeeking = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      analyticsService.trackSeek(lastPositionRef.current, video.currentTime);
    }
  }, []);

  const handleSeeked = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      lastPositionRef.current = video.currentTime;
    }
  }, []);

  const handleWaiting = useCallback(() => {
    if (!isBufferingRef.current) {
      isBufferingRef.current = true;
      analyticsService.trackBufferStart();
      onStateChange?.('buffering');
    }
  }, [onStateChange]);

  const handlePlaying = useCallback(() => {
    if (isBufferingRef.current) {
      isBufferingRef.current = false;
      analyticsService.trackBufferEnd();
    }
    setIsLoading(false);
    onStateChange?.('playing');
  }, [onStateChange]);

  const handleEnded = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      analyticsService.trackComplete(video.duration);
      analyticsService.clearResumePoint(videoId);
    }
    onStateChange?.('ended');
    stopProgressTracking();
  }, [videoId, onStateChange]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      lastPositionRef.current = video.currentTime;
      setCurrentTime(video.currentTime);
    }
  }, []);

  const handleVideoError = useCallback(() => {
    const video = videoRef.current;
    const error = video?.error;
    const msg = error?.message || 'Unknown playback error';
    analyticsService.trackError(msg, error?.code?.toString());
    setErrorMsg(msg);
    onError?.(msg);
    onStateChange?.('error');
  }, [onError, onStateChange]);

  // Progress tracking interval
  const startProgressTracking = useCallback(() => {
    stopProgressTracking();
    const intervalMs = analyticsService.getServerConfig().progressIntervalMs || 10000;

    progressIntervalRef.current = setInterval(() => {
      const video = videoRef.current;
      if (video && !video.paused) {
        const currentTime = video.currentTime;
        const dur = video.duration;

        // Get current quality
        const hls = hlsRef.current;
        let currentQualityStr: string | null = null;
        if (hls && hls.currentLevel >= 0 && hls.levels[hls.currentLevel]) {
          currentQualityStr = hls.levels[hls.currentLevel].height + 'p';
        }

        // Estimate bandwidth
        const bandwidth = hls?.bandwidthEstimate || 0;

        analyticsService.trackProgress(
          currentTime,
          dur,
          currentQualityStr,
          bandwidth,
          video.playbackRate,
        );

        // Callback
        if (dur > 0) {
          onProgress?.(currentTime, dur, (currentTime / dur) * 100);
        }
      }
    }, intervalMs);
  }, [onProgress]);

  const stopProgressTracking = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  // Quality change handler
  const handleQualityChange = useCallback((height: number) => {
    const hls = hlsRef.current;
    if (!hls) return;

    const oldQuality = currentQuality === -1 ? 'Auto' : `${currentQuality}p`;

    if (height === -1) {
      hls.currentLevel = -1;
      setCurrentQuality(-1);
      analyticsService.trackQualityChange(oldQuality, 'Auto', 'user');
    } else {
      const levelIndex = hls.levels.findIndex((l: any) => l.height === height);
      if (levelIndex !== -1) {
        hls.currentLevel = levelIndex;
        setCurrentQuality(height);
        analyticsService.trackQualityChange(oldQuality, `${height}p`, 'user');
      }
    }
    setShowQualityMenu(false);
    setShowSettingsMenu(false);
  }, [currentQuality]);

  // Speed change handler
  const handleSpeedChange = useCallback((rate: number) => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = rate;
      setCurrentSpeed(rate);
    }
    setShowSpeedMenu(false);
    setShowSettingsMenu(false);
  }, []);

  // Format time helper
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatBitrate = (bitrate: number): string => {
    if (bitrate >= 1000000) return `${(bitrate / 1000000).toFixed(1)} Mbps`;
    return `${(bitrate / 1000).toFixed(0)} Kbps`;
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const video = videoRef.current;
      if (!video) return;

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          video.paused ? video.play() : video.pause();
          break;
        case 'f':
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            video.requestFullscreen?.();
          }
          break;
        case 'm':
          video.muted = !video.muted;
          break;
        case 'j':
          video.currentTime = Math.max(0, video.currentTime - 10);
          break;
        case 'l':
          video.currentTime = Math.min(video.duration, video.currentTime + 10);
          break;
        case 'arrowleft':
          video.currentTime = Math.max(0, video.currentTime - 5);
          break;
        case 'arrowright':
          video.currentTime = Math.min(video.duration, video.currentTime + 5);
          break;
        case 'arrowup':
          e.preventDefault();
          video.volume = Math.min(1, video.volume + 0.05);
          break;
        case 'arrowdown':
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.05);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close menus on outside click
  useEffect(() => {
    const handleClick = () => {
      setShowSettingsMenu(false);
      setShowQualityMenu(false);
      setShowSpeedMenu(false);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Progress percentage
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (errorMsg) {
    return (
      <div className={`relative bg-black flex items-center justify-center ${className}`} style={{ aspectRatio: '16/9' }}>
        <div className="text-center text-white p-8">
          <svg className="w-16 h-16 mx-auto mb-4 text-red-500 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-lg font-medium mb-2">خطأ في تشغيل الفيديو</p>
          <p className="text-sm text-gray-400">{errorMsg}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative bg-black overflow-hidden select-none group ${className}`}
      style={{ aspectRatio: '16/9' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-controls]')) return;
        togglePlay();
      }}
    >
      {/* Video element - NO native controls */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        poster={poster}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={handlePlay}
        onPause={handlePause}
        onSeeking={handleSeeking}
        onSeeked={handleSeeked}
        onWaiting={handleWaiting}
        onPlaying={handlePlaying}
        onEnded={handleEnded}
        onTimeUpdate={handleTimeUpdate}
        onError={handleVideoError}
      />

      {/* Loading spinner overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="w-14 h-14 border-4 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Large center play button (when paused) */}
      {!isPlaying && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center pointer-events-auto cursor-pointer transition-transform hover:scale-110"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
          >
            <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}

      {/* Resume prompt */}
      {showResumePrompt && (
        <div
          data-controls
          className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-4 px-5 py-3 rounded-xl shadow-2xl"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
        >
          <span className="text-white text-sm">متابعة من {formatTime(resumeTime)}؟</span>
          <div className="flex gap-2">
            <button onClick={handleResume} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors">متابعة</button>
            <button onClick={() => setShowResumePrompt(false)} className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors">تجاهل</button>
          </div>
        </div>
      )}

      {/* Bottom gradient + controls */}
      <div
        data-controls
        className="absolute bottom-0 left-0 right-0 z-20 transition-opacity duration-300"
        style={{ opacity: showControls || !isPlaying ? 1 : 0, pointerEvents: showControls || !isPlaying ? 'auto' : 'none' }}
      >
        {/* Gradient overlay */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.85))' }} />

        <div className="relative px-4 pb-3 pt-10">
          {/* Progress bar */}
          <div
            ref={progressBarRef}
            className="w-full h-1.5 bg-white/20 rounded-full cursor-pointer mb-3 group/progress hover:h-2.5 transition-all"
            onClick={(e) => { e.stopPropagation(); handleProgressBarClick(e); }}
          >
            {/* Buffered */}
            <div className="absolute h-full bg-white/30 rounded-full" style={{ width: `${progressPct + 2}%`, maxWidth: '100%' }} />
            {/* Progress */}
            <div className="absolute h-full bg-blue-500 rounded-full transition-none" style={{ width: `${progressPct}%` }}>
              {/* Thumb */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-blue-500 rounded-full shadow-lg opacity-0 group-hover/progress:opacity-100 transition-opacity" style={{ transform: 'translate(50%, -50%)' }} />
            </div>
          </div>

          {/* Controls row */}
          <div className="flex items-center justify-between">
            {/* Left controls */}
            <div className="flex items-center gap-3">
              {/* Play/Pause */}
              <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="text-white hover:text-blue-400 transition-colors p-1">
                {isPlaying ? (
                  <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                ) : (
                  <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                )}
              </button>

              {/* Volume */}
              <div className="flex items-center gap-1 group/vol">
                <button onClick={(e) => { e.stopPropagation(); toggleMute(); }} className="text-white hover:text-blue-400 transition-colors p-1">
                  {isMuted || volume === 0 ? (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" /></svg>
                  ) : volume < 0.5 ? (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" /></svg>
                  ) : (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  onClick={(e) => e.stopPropagation()}
                  className="w-0 group-hover/vol:w-20 transition-all duration-200 accent-blue-500 h-1 cursor-pointer opacity-0 group-hover/vol:opacity-100"
                />
              </div>

              {/* Time display */}
              <span className="text-white text-sm font-mono tabular-nums">
                {formatTime(currentTime)} <span className="text-white/50">/</span> {formatTime(duration)}
              </span>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-2">
              {/* Settings (quality + speed) */}
              {qualities.length > 0 && (
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => { setShowSettingsMenu(!showSettingsMenu); setShowQualityMenu(false); setShowSpeedMenu(false); }}
                    className="text-white hover:text-blue-400 transition-colors p-1"
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z" />
                    </svg>
                  </button>

                  {/* Settings menu */}
                  {showSettingsMenu && !showQualityMenu && !showSpeedMenu && (
                    <div className="absolute bottom-full right-0 mb-2 rounded-xl overflow-hidden min-w-[200px] shadow-2xl" style={{ background: 'rgba(20,20,20,0.95)', backdropFilter: 'blur(12px)' }}>
                      <button onClick={() => setShowQualityMenu(true)} className="w-full px-4 py-3 text-left text-sm text-white hover:bg-white/10 transition-colors flex items-center justify-between">
                        <span>الجودة</span>
                        <span className="text-gray-400">{currentQuality === -1 ? 'تلقائي' : `${currentQuality}p`} ›</span>
                      </button>
                      <button onClick={() => setShowSpeedMenu(true)} className="w-full px-4 py-3 text-left text-sm text-white hover:bg-white/10 transition-colors flex items-center justify-between">
                        <span>السرعة</span>
                        <span className="text-gray-400">{currentSpeed === 1 ? 'عادي' : `${currentSpeed}x`} ›</span>
                      </button>
                    </div>
                  )}

                  {/* Quality submenu */}
                  {showQualityMenu && (
                    <div className="absolute bottom-full right-0 mb-2 rounded-xl overflow-hidden min-w-[180px] shadow-2xl max-h-[300px] overflow-y-auto" style={{ background: 'rgba(20,20,20,0.95)', backdropFilter: 'blur(12px)' }}>
                      <button onClick={() => setShowQualityMenu(false)} className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-2 border-b border-white/10">
                        <span>‹</span><span>رجوع</span>
                      </button>
                      <button onClick={() => handleQualityChange(-1)} className={`w-full px-4 py-2.5 text-left text-sm hover:bg-white/10 transition-colors flex items-center justify-between ${currentQuality === -1 ? 'text-blue-400 bg-white/5' : 'text-white'}`}>
                        <span>تلقائي</span>
                        {currentQuality === -1 && <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                      </button>
                      {qualities.map((q) => (
                        <button key={q.height} onClick={() => handleQualityChange(q.height)} className={`w-full px-4 py-2.5 text-left text-sm hover:bg-white/10 transition-colors flex items-center justify-between ${currentQuality === q.height ? 'text-blue-400 bg-white/5' : 'text-white'}`}>
                          <span>{q.height}p</span>
                          {currentQuality === q.height && <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Speed submenu */}
                  {showSpeedMenu && (
                    <div className="absolute bottom-full right-0 mb-2 rounded-xl overflow-hidden min-w-[160px] shadow-2xl" style={{ background: 'rgba(20,20,20,0.95)', backdropFilter: 'blur(12px)' }}>
                      <button onClick={() => setShowSpeedMenu(false)} className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-2 border-b border-white/10">
                        <span>‹</span><span>رجوع</span>
                      </button>
                      {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
                        <button key={rate} onClick={() => handleSpeedChange(rate)} className={`w-full px-4 py-2.5 text-left text-sm hover:bg-white/10 transition-colors flex items-center justify-between ${currentSpeed === rate ? 'text-blue-400 bg-white/5' : 'text-white'}`}>
                          <span>{rate === 1 ? 'عادي' : `${rate}x`}</span>
                          {currentSpeed === rate && <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Fullscreen */}
              <button onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} className="text-white hover:text-blue-400 transition-colors p-1">
                {isFullscreen ? (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" /></svg>
                ) : (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" /></svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export { CustomVideoPlayer };
export default CustomVideoPlayer;
