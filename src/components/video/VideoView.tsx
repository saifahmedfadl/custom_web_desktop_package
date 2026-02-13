import { useRouter } from 'next/navigation';
import React, { useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { useVideoProgress } from '../../hooks/useVideoProgress';
import { CustomButton } from '../common/CustomButton';
import { CustomText } from '../common/CustomText';
import { CustomVideoPlayer } from './CustomVideoPlayer';

export const VideoView: React.FC = () => {
  const router = useRouter();
  const { qrCode, config, resetQrCodeData } = useApp();
  const { updateProgress } = useVideoProgress(qrCode);

  const handleBackClick = () => {
    resetQrCodeData();
    router.push('/');
  };

  // Handle progress from custom player - also save to Firebase/API
  const handleProgress = useCallback((currentTime: number, duration: number, progressPct: number) => {
    updateProgress(currentTime, duration);
  }, [updateProgress]);

  // If no QR code or video data, redirect to home
  if (!qrCode || (!qrCode.videoID && !qrCode.youtubeId)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <CustomText
          text="لا يوجد بيانات فيديو متاحة. جاري إعادة التوجيه..."
          fontSize={18}
          color="black"
        />
      </div>
    );
  }

  // Determine if we should use the custom HLS player or YouTube fallback
  // Only use custom player when we have an actual HLS URL from the QR data
  const videoStreamBaseUrl = config?.videoStreamBaseUrl;
  const videoStreamToken = config?.videoStreamToken;
  const hlsUrl = qrCode.videoModel?.hlsVideo;
  const hasHlsVideo = !!hlsUrl && hlsUrl.length > 0;
  const hasCustomPlayer = hasHlsVideo;

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="bg-gray-900 text-white h-[70px] flex items-center justify-between px-4">
        <div className="flex items-center">
          <CustomButton
            text="رجوع"
            onClick={handleBackClick}
            fontSize={14}
            textColor="white"
            borderRadius={8}
            padding="8px 16px"
            bold={true}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 transition-colors duration-200"
            iconLeft={
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            }
          />
        </div>
        <div className="flex-1 flex justify-center">
          <CustomText
            text={qrCode.videoName || 'مشغل الفيديو'}
            fontSize={18}
            color="white"
            bold={true}
          />
        </div>
        <div className="w-[100px]"></div>
      </div>

      {/* Video container */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 bg-gray-100">
        <div 
          className="w-full shadow-lg"
          style={{ maxWidth: '1000px' }}
        >
          {hasCustomPlayer ? (
            <CustomVideoPlayer
              videoStreamBaseUrl={videoStreamBaseUrl || ''}
              videoId={qrCode.videoID || ''}
              authToken={videoStreamToken}
              hlsUrl={hlsUrl}
              source="web"
              onProgress={handleProgress}
              onError={(error) => console.error('[VideoView] Player error:', error)}
            />
          ) : (
            <div 
              className="relative bg-black rounded-md w-full overflow-hidden"
              style={{ aspectRatio: '16/9' }}
            >
              <iframe 
                src={`https://youtube-iframe-pi.vercel.app/embed.html?videoId=${qrCode.youtubeId || qrCode.videoID}`}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="YouTube Video Player"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
