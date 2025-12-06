'use client';

import { StaticImageData } from 'next/image';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useQrCode } from '../../hooks/useQrCode';
import { CustomSnackBar } from '../common/CustomSnackBar';
import { LoginView } from './LoginView';

interface LoginControllerProps {
  version?: string;
  logo: StaticImageData;
  background: StaticImageData;
}

export const LoginController: React.FC<LoginControllerProps> = ({
  version = '1.0.0',
  logo,
  background,
}) => {
  const router = useRouter();
  const { qrCode, error: appError } = useApp();
  const [deviceId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const {
    qrId,
    polling,
    maxRetriesReached,
    hasVideo,
    createQrCode,
    retryQrCode,
  } = useQrCode();

  // Navigate to video player when a video is available
  useEffect(() => {
    if (qrCode && hasVideo) {
      // Only navigate to video if there's a valid videoID or youtubeId with a non-empty value
      if ((qrCode.videoID && qrCode.videoID.length > 0) || (qrCode.youtubeId && qrCode.youtubeId.length > 0)) {
        router.push('/video');
      }
    }
  }, [qrCode, hasVideo, router]);

  // Handle app context errors
  useEffect(() => {
    if (appError) {
      setError(appError);
    }
  }, [appError]);

  // Handle max retries reached
  useEffect(() => {
    if (maxRetriesReached) {
      setError('Maximum retry attempts reached. Please try again later.');
    }
  }, [maxRetriesReached]);

  const handleGenerateQrCode = async () => {
    try {
      setError(null);
      await createQrCode();
    } catch (err) {
      setError('Failed to generate QR code. Please try again.');
      console.error('Error generating QR code', err);
    }
  };

  const handleRetryQrCode = async () => {
    try {
      setError(null);
      await retryQrCode();
    } catch (err) {
      setError('Failed to regenerate QR code. Please try again.');
      console.error('Error regenerating QR code', err);
    }
  };

  const handleCloseError = () => {
    setError(null);
  };

  return (
    <>
      <LoginView
        deviceId={deviceId}
        qrId={qrId}
        polling={polling}
        onGenerateQrCode={handleGenerateQrCode}
        onRetryQrCode={handleRetryQrCode}
        version={version}
        logo={logo}
        background={background}
      />
      {error && (
        <CustomSnackBar
          message={error}
          type="error"
          duration={5000}
          onClose={handleCloseError}
        />
      )}
    </>
  );
};
