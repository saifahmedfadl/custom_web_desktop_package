'use client';

import React, { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppConfig, QrModelWindows } from '../models/QrModel';
import { apiService, QrEventSubscription } from '../services/api';
import { getDeviceId } from '../utils/device';

interface AppContextType {
  config: AppConfig | null;
  deviceId: string;
  qrCode: QrModelWindows | null;
  isLoading: boolean;
  error: string | null;
  setQrCode: (qrCode: QrModelWindows) => void;
  createQrCode: () => Promise<QrModelWindows | null>;
  retryConnection: () => void;
  resetQrCodeData: () => void;
}

const defaultConfig: AppConfig = {
  primaryColor: '#000000',
  initializeFirebase: () => {},
  watchedOffline: false,
  nameAdmin: 'Teacher App',
  baseUrl: '',
  usingApi: true,
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{
  children: ReactNode;
  initialConfig?: Partial<AppConfig>;
}> = ({ children, initialConfig }) => {
  const [config] = useState<AppConfig>({
    ...defaultConfig,
    ...initialConfig,
  });
  const [deviceId, setDeviceId] = useState<string>('');
  const [qrCode, setQrCode] = useState<QrModelWindows | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Holds the live Firestore onSnapshot subscription. We keep this in a
  // ref (not state) because closing it must be synchronous — closing it
  // through a state update would race with React batching.
  const subscriptionRef = useRef<QrEventSubscription | null>(null);

  const closeSubscription = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.close();
      subscriptionRef.current = null;
    }
  }, []);

  // Subscribe (or re-subscribe) to QR updates for a given QR id.
  // Idempotent: closes any existing subscription first, so callers
  // (createQrCode, retryConnection) don't have to manage that.
  const subscribeToQr = useCallback((qrId: string) => {
    closeSubscription();

    subscriptionRef.current = apiService.subscribeToQrUpdates(qrId, {
      onUpdate: (data) => {
        setQrCode(data);
      },
      onDone: (data) => {
        setQrCode(data);
        closeSubscription();
      },
      onTimeout: () => {
        // No-op for the Firestore onSnapshot backend (kept for backward
        // compat with the previous SSE implementation). Firestore listeners
        // don't have a server-side stream timeout; the SDK reconnects
        // transparently across network drops.
        setError('تم انتهاء وقت الاتصال');
        closeSubscription();
      },
      onError: (err) => {
        console.error('qr subscription error:', err);
        setError('تم انتهاء وقت الاتصال');
        closeSubscription();
      },
    });
  }, [closeSubscription]);

  useEffect(() => {
    if (config.baseUrl) {
      apiService.initialize(config.baseUrl);
    }
    const id = getDeviceId();
    setDeviceId(id);

    return () => {
      closeSubscription();
    };
  }, [config, closeSubscription]);

  const createQrCode = useCallback(async (): Promise<QrModelWindows | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const qrData = await apiService.createQrCode(deviceId);

      if (!qrData || !qrData.id) {
        throw new Error('Failed to create QR code');
      }

      setQrCode(qrData);
      subscribeToQr(qrData.id);
      return qrData;
    } catch (err) {
      console.error('Error creating QR code app context', err);
      setError('Failed to create QR code. Please try again.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [deviceId, subscribeToQr]);

  // Auto-create the first QR once we know the device id. We intentionally
  // depend only on deviceId — recreating it on every context re-render
  // would spawn duplicate QR docs.
  useEffect(() => {
    if (deviceId) {
      createQrCode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  // Reconnect on the SAME QR id without spawning a new doc. Used when
  // the user taps retry after a transient subscription error.
  const retryConnection = useCallback(() => {
    setError(null);
    if (qrCode?.id) {
      subscribeToQr(qrCode.id);
    } else {
      // No QR yet (initial create failed). Fall back to creating one.
      createQrCode();
    }
  }, [qrCode, subscribeToQr, createQrCode]);

  // Hard reset — used when the caller explicitly wants a brand-new QR
  // (e.g. after a successful video session ends).
  const resetQrCodeData = useCallback(() => {
    closeSubscription();
    setQrCode({
      id: '',
      videoID: '',
      youtubeId: '',
      videoUrl: '',
      videoName: '',
      subtitle: '',
      videoModel: { hlsVideo: '', webmVideo: '' },
    } as QrModelWindows);
    setError(null);
    setIsLoading(false);
    createQrCode();
  }, [closeSubscription, createQrCode]);

  const value: AppContextType = {
    config,
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

export const initializeDesktopTeacher = (config: Partial<AppConfig>): void => {
  console.log('Desktop Teacher app initialized with config:', config);
};
