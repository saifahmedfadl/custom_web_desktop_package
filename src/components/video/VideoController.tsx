import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useVideoProgress } from '../../hooks/useVideoProgress';
import { formatPercentage, formatTime } from '../../utils/formatting';
import { CustomButton } from '../common/CustomButton';
import { CustomSnackBar } from '../common/CustomSnackBar';
import { CustomText } from '../common/CustomText';
import { CustomVideoPlayer } from './CustomVideoPlayer';

interface VideoControllerProps {
  onBack: () => void;
}

export const VideoController: React.FC<VideoControllerProps> = ({ onBack }) => {
  const router = useRouter();
  const { qrCode, config } = useApp();
  const { videoState, updateProgress, setPlaying, setLoading, setError } = useVideoProgress(qrCode);
  const [showMessage, setShowMessage] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!qrCode || !qrCode.videoID) {
      router.push('/');
    }
  }, [qrCode, router]);

  const handleProgress = useCallback((currentTime: number, duration: number, progressPct: number) => {
    updateProgress(currentTime, duration);
  }, [updateProgress]);

  const handleStateChange = useCallback((state: 'playing' | 'paused' | 'buffering' | 'ended' | 'error') => {
    setPlaying(state === 'playing');
    setLoading(state === 'buffering');
    
    if (state === 'ended') {
      showNotification('اكتمل الفيديو');
    }
  }, [setPlaying, setLoading]);

  const handleReady = useCallback((duration: number) => {
    setLoading(false);
  }, [setLoading]);

  const handleError = useCallback((error: string) => {
    setError(error);
    showNotification(`خطأ: ${error}`);
  }, [setError]);

  const showNotification = (msg: string) => {
    setMessage(msg);
    setShowMessage(true);
    setTimeout(() => setShowMessage(false), 3000);
  };

  if (!qrCode || !qrCode.videoID) {
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

  const videoStreamBaseUrl = config?.videoStreamBaseUrl;
  const videoStreamToken = config?.videoStreamToken;
  const hlsUrl = qrCode.videoModel?.hlsVideo || qrCode.videoModel?.hls_video;
  const hasHlsVideo = !!hlsUrl && hlsUrl.length > 0;
  const hasCustomPlayer = hasHlsVideo;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-gray-900 text-white h-[70px] flex items-center justify-between px-4">
        <div className="flex items-center">
          <CustomButton
            text="← رجوع"
            onClick={onBack}
            fontSize={14}
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
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div 
          className="w-full"
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
              onStateChange={handleStateChange}
              onReady={handleReady}
              onError={handleError}
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
        
        {/* Progress info */}
        <div className="mt-4 w-full max-w-[1000px]">
          <div className="flex justify-between items-center mb-2">
            <CustomText
              text={formatTime(videoState.currentTime)}
              fontSize={14}
              color="black"
            />
            <CustomText
              text={`${formatPercentage(videoState.progress, 1)}`}
              fontSize={14}
              color="black"
              bold={true}
            />
            <CustomText
              text={formatTime(videoState.duration)}
              fontSize={14}
              color="black"
            />
          </div>
          
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${videoState.progress}%` }}
            ></div>
          </div>
          
          {/* Thresholds info */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className={`p-2 rounded ${videoState.thresholds.fivePercent ? 'bg-green-100' : 'bg-gray-100'}`}>
              <CustomText text="5% تمت المشاهدة" fontSize={12} color={videoState.thresholds.fivePercent ? 'green' : 'gray'} bold={videoState.thresholds.fivePercent} />
            </div>
            <div className={`p-2 rounded ${videoState.thresholds.twentyPercent ? 'bg-green-100' : 'bg-gray-100'}`}>
              <CustomText text="20% تمت المشاهدة" fontSize={12} color={videoState.thresholds.twentyPercent ? 'green' : 'gray'} bold={videoState.thresholds.twentyPercent} />
            </div>
            <div className={`p-2 rounded ${videoState.thresholds.twentyFivePercent ? 'bg-green-100' : 'bg-gray-100'}`}>
              <CustomText text="25% تمت المشاهدة" fontSize={12} color={videoState.thresholds.twentyFivePercent ? 'green' : 'gray'} bold={videoState.thresholds.twentyFivePercent} />
            </div>
            <div className={`p-2 rounded ${videoState.thresholds.fortyPercent ? 'bg-green-100' : 'bg-gray-100'}`}>
              <CustomText text="40% تمت المشاهدة" fontSize={12} color={videoState.thresholds.fortyPercent ? 'green' : 'gray'} bold={videoState.thresholds.fortyPercent} />
            </div>
            <div className={`p-2 rounded ${videoState.thresholds.sixtyPercent ? 'bg-green-100' : 'bg-gray-100'}`}>
              <CustomText text="60% تمت المشاهدة" fontSize={12} color={videoState.thresholds.sixtyPercent ? 'green' : 'gray'} bold={videoState.thresholds.sixtyPercent} />
            </div>
            <div className={`p-2 rounded ${videoState.thresholds.eightyPercent ? 'bg-green-100' : 'bg-gray-100'}`}>
              <CustomText text="80% تمت المشاهدة" fontSize={12} color={videoState.thresholds.eightyPercent ? 'green' : 'gray'} bold={videoState.thresholds.eightyPercent} />
            </div>
            <div className={`p-2 rounded ${videoState.thresholds.ninetyFivePercent ? 'bg-green-100' : 'bg-gray-100'} col-span-2`}>
              <CustomText text="95% تمت المشاهدة" fontSize={12} color={videoState.thresholds.ninetyFivePercent ? 'green' : 'gray'} bold={videoState.thresholds.ninetyFivePercent} />
            </div>
          </div>
        </div>
      </div>
      
      {/* Notification */}
      {showMessage && (
        <CustomSnackBar
          message={message}
          type="info"
          duration={3000}
          onClose={() => setShowMessage(false)}
        />
      )}
    </div>
  );
}; 