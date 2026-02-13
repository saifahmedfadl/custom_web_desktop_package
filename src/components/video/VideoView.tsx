import { useRouter } from 'next/navigation';
import React from 'react';
import { useApp } from '../../context/AppContext';
import { CustomButton } from '../common/CustomButton';
import { CustomText } from '../common/CustomText';

/**
 * Extract video-stream server video ID from HLS URL.
 * URL format: https://videostream.nexwavetec.com/api/v1/videos/{VIDEO_ID}/stream/master.m3u8
 */
function extractVideoStreamId(hlsUrl: string): string | null {
  const match = hlsUrl.match(/\/videos\/([a-f0-9]+)\/stream/i);
  return match ? match[1] : null;
}

export const VideoView: React.FC = () => {
  const router = useRouter();
  const { qrCode, config, resetQrCodeData } = useApp();

  const handleBackClick = () => {
    resetQrCodeData();
    router.push('/');
  };

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

  // Check for HLS video (Cloud Function saves with snake_case keys)
  const videoStreamBaseUrl = config?.videoStreamBaseUrl || 'https://videostream.nexwavetec.com';
  const videoStreamToken = config?.videoStreamToken || '';
  const hlsUrl = qrCode.videoModel?.hlsVideo || qrCode.videoModel?.hls_video;
  const hasHlsVideo = !!hlsUrl && hlsUrl.length > 0;

  // Extract video-stream server ID from the HLS URL
  const videoStreamId = hasHlsVideo ? extractVideoStreamId(hlsUrl!) : null;

  // Debug: log the actual values to diagnose video ID issues
  if (typeof window !== 'undefined') {
    console.log('[VideoView] hlsUrl:', hlsUrl);
    console.log('[VideoView] videoStreamId extracted:', videoStreamId);
    console.log('[VideoView] videoStreamToken:', videoStreamToken);
    console.log('[VideoView] qrCode.videoModel:', JSON.stringify(qrCode.videoModel));
  }

  // Build the iframe URL for the video-stream player (same as dashboard)
  const playerBaseUrl = videoStreamBaseUrl.replace(/\/api\/v1$/, '');
  const playerIframeUrl = videoStreamId
    ? `${playerBaseUrl}/player/index.html?v=${videoStreamId}&token=${videoStreamToken}&autoplay=false&source=web`
    : null;

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
          <div 
            className="relative bg-black rounded-md w-full overflow-hidden"
            style={{ aspectRatio: '16/9' }}
          >
            {playerIframeUrl ? (
              <iframe
                src={playerIframeUrl}
                className="w-full h-full border-0"
                allowFullScreen
                allow="autoplay; encrypted-media; picture-in-picture"
                title="Video Player"
              />
            ) : (
              <iframe 
                src={`https://youtube-iframe-pi.vercel.app/embed.html?videoId=${qrCode.youtubeId || qrCode.videoID}`}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="YouTube Video Player"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
