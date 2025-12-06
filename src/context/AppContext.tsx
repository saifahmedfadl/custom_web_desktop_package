'use client';

import React, { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { TeacherAppConfig } from '../config/types';
import { QrModelWindows } from '../models/QrModel';
import { apiService } from '../services/api';
import { getDeviceId } from '../utils/device';

interface AppContextType {
  config: TeacherAppConfig | null;
  deviceId: string;
  qrCode: QrModelWindows | null;
  isLoading: boolean;
  error: string | null;
  setQrCode: (qrCode: QrModelWindows) => void;
  createQrCode: () => Promise<QrModelWindows | null>;
  retryConnection: () => void;
  resetQrCodeData: () => void;
}

const defaultConfig: TeacherAppConfig = {
  primaryColor: '#000000',
  initializeFirebase: () => {},
  watchedOffline: false,
  nameAdmin: 'Teacher App',
  baseUrl: '',
  usingApi: true,
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export interface AppProviderProps {
  children: ReactNode;
  config?: TeacherAppConfig;
  initialConfig?: Partial<TeacherAppConfig>;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children, config, initialConfig }) => {
  // Support both config and initialConfig for compatibility
  const mergedConfig = {
    ...defaultConfig,
    ...config,
    ...initialConfig,
  };
  const [deviceId, setDeviceId] = useState<string>('');
  const [qrCode, setQrCode] = useState<QrModelWindows | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pollingTimer, setPollingTimer] = useState<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef<number>(0);
  const MAX_RETRIES = 10;

  useEffect(() => {
    // Initialize API service with config
    const baseUrl = mergedConfig.apiBaseUrl || mergedConfig.baseUrl;
    if (baseUrl) {
      apiService.initialize(baseUrl, mergedConfig.version);
    }
    
    // Initialize device ID
    const id = getDeviceId();
    setDeviceId(id);

    // Cleanup polling timer when component unmounts
    return () => {
      if (pollingTimer) {
        clearInterval(pollingTimer);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollingTimer]);
  
  // Create QR code once when device ID is set
  useEffect(() => {
    if (deviceId) {
      createQrCode();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  const createQrCode = async (): Promise<QrModelWindows | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const qrData = await apiService.createQrCode(deviceId);
      
      if (!qrData || !qrData.id) {
        throw new Error('Failed to create QR code');
      }
      
      setQrCode(qrData);
      
      // Start polling for updates after creating QR code
      startPolling(qrData.id);
      
      return qrData;
    } catch (err) {
      console.error('Error creating QR code app context', err);
      setError('Failed to create QR code. Please try again.');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const startPolling = (qrId: string) => {
    // Clear any existing polling timer
    if (pollingTimer) {
      clearInterval(pollingTimer);
    }

    retryCountRef.current = 0;

    // Start a new polling timer
    const timer = setInterval(async () => {
      // If max retries reached, stop polling
      if (retryCountRef.current >= MAX_RETRIES) {
        console.log(`Reached maximum retry count (${MAX_RETRIES}), stopping polling`);
        clearInterval(timer);
        setPollingTimer(null);
        setError('تم انتهاء وقت الاتصال');
        return;
      }

      try {
        // Increment the count using the ref
        retryCountRef.current += 1;
        console.log(`Polling attempt ${retryCountRef.current} of ${MAX_RETRIES} for QR ID: ${qrId}`);

        const response = await apiService.getQrCodeStatus(qrId);

        console.log(
          `Received response from getQrData: ${response ? 'Data received' : 'No data'}`
        );

        if (response) {
          setQrCode(response);

          // Check if we have a valid video to watch
          const hasVideoUrl = response.videoUrl && response.videoUrl.length > 0;
          const hasYoutubeId = response.youtubeId && response.youtubeId.length > 0;
          const hasHlsVideo = response.videoModel?.hlsVideo && response.videoModel.hlsVideo.length > 0;
          const hasWebmVideo = response.videoModel?.webmVideo && response.videoModel.webmVideo.length > 0;

          if (hasVideoUrl || hasYoutubeId || hasHlsVideo || hasWebmVideo) {
            console.log('Valid video found - cancelling polling');
            clearInterval(timer);
            setPollingTimer(null);
            retryCountRef.current = 0;
            // Navigation to video view will be handled by the component using this data
            return;
          }
        }
      } catch (err) {
        console.error('Polling error:', err);

        // Implement exponential backoff for network errors
        const isNetworkError = String(err).includes('network') || 
                               String(err).includes('connection') ||
                               String(err).includes('timeout');

        if (isNetworkError) {
          const backoffSeconds = retryCountRef.current < 5 ? 5 : (retryCountRef.current < 10 ? 10 : 15);
          console.log(`Network error detected. Will retry in ${backoffSeconds} seconds`);

          // Cancel current timer
          clearInterval(timer);
          setPollingTimer(null);

          // Only restart if not at max retries
          if (retryCountRef.current < MAX_RETRIES) {
            setTimeout(() => {
              if (!error) {
                startPolling(qrId);
              }
            }, backoffSeconds * 1000);
          } else {
            setError('تم انتهاء وقت الاتصال');
          }
        }
      }
    }, 5000); // Poll every 5 seconds

    setPollingTimer(timer);
  };

  const retryConnection = () => {
    setError(null);
    if (pollingTimer) {
      clearInterval(pollingTimer);
      setPollingTimer(null);
    }
    retryCountRef.current = 0;
    createQrCode();
  };

  // Function to completely reset QR code data
  const resetQrCodeData = () => {
    // Clear any ongoing polling
    if (pollingTimer) {
      clearInterval(pollingTimer);
      setPollingTimer(null);
    }
    
    // Reset QR code data with empty values to ensure no video can be detected
    setQrCode({
      id: '',
      videoID: '',
      youtubeId: '',
      videoUrl: '',
      videoName: '',
      subtitle: '',
      videoModel: { hlsVideo: '', webmVideo: '' }
    } as QrModelWindows);
    
    setError(null);
    retryCountRef.current = 0;
    setIsLoading(false);
    createQrCode();
  };

  const value: AppContextType = {
    config: mergedConfig,
    deviceId,
    qrCode,
    isLoading,
    error,
    setQrCode,
    createQrCode,
    retryConnection,
    resetQrCodeData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  
  return context;
};
