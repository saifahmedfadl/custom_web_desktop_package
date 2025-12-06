import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';

export const useQrCode = () => {
  const { qrCode, isLoading, error, createQrCode: contextCreateQrCode, retryConnection } = useApp();
  const [qrId, setQrId] = useState<string | null>(null);
  const [polling, setPolling] = useState<boolean>(false);
  const [maxRetriesReached, setMaxRetriesReached] = useState<boolean>(false);

  // Update QR ID when qrCode changes
  useEffect(() => {
    if (qrCode && qrCode.id) {
      setQrId(qrCode.id);
    }
  }, [qrCode]);

  // Update polling status based on isLoading
  useEffect(() => {
    setPolling(isLoading);
  }, [isLoading]);

  // Update maxRetriesReached based on error
  useEffect(() => {
    if (error && error.includes('تم انتهاء وقت الاتصال')) {
      setMaxRetriesReached(true);
    } else {
      setMaxRetriesReached(false);
    }
  }, [error]);

  const resetQrCode = useCallback(() => {
    setQrId(null);
    setPolling(false);
    setMaxRetriesReached(false);
  }, []);

  const createQrCode = useCallback(async () => {
    try {
      resetQrCode();
      const qrData = await contextCreateQrCode();
      
      if (qrData && qrData.id) {
        setQrId(qrData.id);
        setPolling(true);
        return qrData.id;
      }
      
      return null;
    } catch (error) {
      console.error('Error creating QR code useQrCode', error);
      return null;
    }
  }, [contextCreateQrCode, resetQrCode]);

  const retryQrCode = useCallback(async () => {
    try {
      resetQrCode();
      retryConnection();
      return true;
    } catch (error) {
      console.error('Error retrying QR code connection', error);
      return false;
    }
  }, [retryConnection, resetQrCode]);

  // Check if the QR code has a video attached
  const hasVideo = useCallback(() => {
    if (!qrCode) return false;
    
    const hasVideoUrl = qrCode.videoUrl && qrCode.videoUrl.length > 0;
    const hasYoutubeId = qrCode.youtubeId && qrCode.youtubeId.length > 0;
    const hasHlsVideo = qrCode.videoModel?.hlsVideo && qrCode.videoModel.hlsVideo.length > 0;
    const hasWebmVideo = qrCode.videoModel?.webmVideo && qrCode.videoModel.webmVideo.length > 0;
    
    return hasVideoUrl || hasYoutubeId || hasHlsVideo || hasWebmVideo;
  }, [qrCode]);

  return {
    qrId,
    polling,
    maxRetriesReached,
    hasVideo: hasVideo(),
    createQrCode,
    retryQrCode,
    resetQrCode,
  };
};
