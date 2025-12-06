import React, { useEffect, useRef } from 'react';

interface YouTubePlayerProps {
  videoId: string;
  onProgress: (currentTime: number, duration: number) => void;
  onStateChange?: (state: number) => void;
  onReady?: () => void;
  onError?: (error: Error) => void;
}

// YouTube Player States
const YT_UNSTARTED = -1;
const YT_ENDED = 0;
const YT_PLAYING = 1;
const YT_PAUSED = 2;
const YT_BUFFERING = 3;
const YT_CUED = 5;

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  videoId,
  onProgress,
  onStateChange,
  onReady,
  onError,
}) => {
  const playerRef = useRef<YT.Player | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Load YouTube API
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    // Create YouTube player when API is ready
    const onYouTubeIframeAPIReady = () => {
      if (!containerRef.current) return;

      try {
        playerRef.current = new YT.Player(containerRef.current, {
          videoId,
          playerVars: {
            autoplay: 0,
            controls: 1,
            rel: 0,
            fs: 1,
            modestbranding: 1,
          },
          events: {
            onReady: handleReady,
            onStateChange: handleStateChange,
            onError: (event) => {
              const error = new Error(`YouTube player error: ${event.data}`);
              console.error(error);
              if (onError) onError(error);
            },
          },
        });
      } catch (error) {
        console.error('Error initializing YouTube player', error);
        if (onError) onError(error instanceof Error ? error : new Error(String(error)));
      }
    };

    // Define the global callback for the YouTube API
    if (!(window as any).onYouTubeIframeAPIReady) {
      (window as any).onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;
    } else {
      // If already defined, call it directly
      onYouTubeIframeAPIReady();
    }

    return () => {
      // Clean up
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, [videoId, onError]);

  const handleReady = () => {
    if (onReady) onReady();
  };

  const handleStateChange = (event: YT.OnStateChangeEvent) => {
    if (onStateChange) onStateChange(event.data);

    // Start tracking progress when video is playing
    if (event.data === YT_PLAYING) {
      startProgressTracking();
    } else if (event.data === YT_PAUSED || event.data === YT_ENDED) {
      stopProgressTracking();
    }
  };

  const startProgressTracking = () => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }

    progressInterval.current = setInterval(() => {
      if (playerRef.current) {
        const currentTime = playerRef.current.getCurrentTime();
        const duration = playerRef.current.getDuration();
        onProgress(currentTime, duration);
      }
    }, 1000);
  };

  const stopProgressTracking = () => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }
  };

  return (
    <div className="youtube-player-container" style={{ width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}; 