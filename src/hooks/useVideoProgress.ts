import { useCallback, useState } from 'react';
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

  const updateProgress = useCallback((currentTime: number, duration: number) => {
    if (duration <= 0) return;
    
    const progress = (currentTime / duration) * 100;
    
    setVideoState(prev => ({
      ...prev,
      currentTime,
      duration,
      progress,
    }));
    
    // Check if any thresholds have been reached
    const newThresholds = { ...videoState.thresholds };
    let thresholdReached = false;
    
    if (progress >= 5 && !newThresholds.fivePercent) {
      newThresholds.fivePercent = true;
      thresholdReached = true;
    }
    
    if (progress >= 20 && !newThresholds.twentyPercent) {
      newThresholds.twentyPercent = true;
      thresholdReached = true;
    }
    
    if (progress >= 25 && !newThresholds.twentyFivePercent) {
      newThresholds.twentyFivePercent = true;
      thresholdReached = true;
    }
    
    if (progress >= 40 && !newThresholds.fortyPercent) {
      newThresholds.fortyPercent = true;
      thresholdReached = true;
    }
    
    if (progress >= 60 && !newThresholds.sixtyPercent) {
      newThresholds.sixtyPercent = true;
      thresholdReached = true;
    }
    
    if (progress >= 80 && !newThresholds.eightyPercent) {
      newThresholds.eightyPercent = true;
      thresholdReached = true;
    }
    
    if (progress >= 95 && !newThresholds.ninetyFivePercent) {
      newThresholds.ninetyFivePercent = true;
      thresholdReached = true;
    }
    
    if (thresholdReached) {
      setVideoState(prev => ({
        ...prev,
        thresholds: newThresholds,
      }));
      
      // If a threshold was reached, save progress to Firebase
      if (videoData?.videoID && videoData?.userUuid) {
        saveProgress(progress);
      }
    }
  }, [videoData, videoState.thresholds]);

  const saveProgress = useCallback(async (progress: number) => {
    if (!videoData?.videoID || !videoData?.userUuid) return;
    
    try {
      const threshold = Math.floor(progress);
      
      if (config?.usingApi) {
        await apiService.updateVideoProgress(
          videoData.userUuid,
          videoData.videoID,
          videoData.subtitle || '',
          threshold
        );
      } else {
        await firebaseService.updateVideoProgress(
          videoData.userUuid,
          videoData.videoID,
          videoData.subtitle || '',
          threshold
        );
      }
    } catch (error) {
      console.error('Error saving video progress', error);
    }
  }, [videoData, config]);

  const setPlaying = useCallback((isPlaying: boolean) => {
    setVideoState(prev => ({
      ...prev,
      isPlaying,
    }));
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setVideoState(prev => ({
      ...prev,
      loading,
    }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setVideoState(prev => ({
      ...prev,
      error,
    }));
  }, []);

  const resetProgress = useCallback(() => {
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

  return {
    videoState,
    updateProgress,
    setPlaying,
    setLoading,
    setError,
    resetProgress,
  };
}; 