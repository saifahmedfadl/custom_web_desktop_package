import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';

export const useQrCode = () => {
  const { qrCode, isLoading, error, createQrCode: contextCreateQrCode, retryConnection } = useApp();
  const [qrId, setQrId] = useState<string | null>(null);
  const [maxRetriesReached, setMaxRetriesReached] = useState<boolean>(false);

  useEffect(() => {
    if (qrCode && qrCode.id) {
      setQrId(qrCode.id);
    }
  }, [qrCode]);

  // "تم انتهاء وقت الاتصال" is set by AppContext on a hard subscription
  // error — that's the signal the UI uses to surface the retry CTA.
  useEffect(() => {
    setMaxRetriesReached(Boolean(error && error.includes('تم انتهاء وقت الاتصال')));
  }, [error]);

  // Has a QR but no video resolved yet AND no error AND not currently
  // creating the QR → we're actively waiting on a scan.
  const polling = Boolean(qrId) && !isLoading && !error && !hasVideoOnQr(qrCode);

  const resetQrCode = useCallback(() => {
    setQrId(null);
    setMaxRetriesReached(false);
  }, []);

  const createQrCode = useCallback(async () => {
    try {
      resetQrCode();
      const qrData = await contextCreateQrCode();
      if (qrData && qrData.id) {
        setQrId(qrData.id);
        return qrData.id;
      }
      return null;
    } catch (err) {
      console.error('Error creating QR code useQrCode', err);
      return null;
    }
  }, [contextCreateQrCode, resetQrCode]);

  // Cheap retry: re-attaches the onSnapshot listener on the existing QR.
  // AppContext only falls back to creating a new doc if no QR exists yet.
  const retryQrCode = useCallback(async () => {
    try {
      setMaxRetriesReached(false);
      retryConnection();
      return true;
    } catch (err) {
      console.error('Error retrying QR code connection', err);
      return false;
    }
  }, [retryConnection]);

  return {
    qrId,
    polling,
    maxRetriesReached,
    hasVideo: hasVideoOnQr(qrCode),
    createQrCode,
    retryQrCode,
    resetQrCode,
  };
};

function hasVideoOnQr(qr: ReturnType<typeof useApp>['qrCode']): boolean {
  if (!qr) return false;
  const hasVideoUrl = !!qr.videoUrl && qr.videoUrl.length > 0;
  const hasYoutubeId = !!qr.youtubeId && qr.youtubeId.length > 0;
  const hasHlsVideo =
    (!!qr.videoModel?.hlsVideo && qr.videoModel.hlsVideo.length > 0) ||
    (!!qr.videoModel?.hls_video && qr.videoModel.hls_video.length > 0);
  const hasWebmVideo =
    (!!qr.videoModel?.webmVideo && qr.videoModel.webmVideo.length > 0) ||
    (!!qr.videoModel?.webm_video && qr.videoModel.webm_video.length > 0);
  return hasVideoUrl || hasYoutubeId || hasHlsVideo || hasWebmVideo;
}
