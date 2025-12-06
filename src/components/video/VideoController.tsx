import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useVideoProgress } from '../../hooks/useVideoProgress';
import { formatPercentage, formatTime } from '../../utils/formatting';
import { CustomButton } from '../common/CustomButton';
import { CustomSnackBar } from '../common/CustomSnackBar';
import { CustomText } from '../common/CustomText';
import { YouTubePlayer } from './YouTubePlayer';

interface VideoControllerProps {
  onBack: () => void;
}

export const VideoController: React.FC<VideoControllerProps> = ({ onBack }) => {
  const router = useRouter();
  const { qrCode } = useApp();
  const { videoState, updateProgress, setPlaying, setLoading, setError, resetProgress } = useVideoProgress(qrCode);
  const [showMessage, setShowMessage] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!qrCode || !qrCode.videoID) {
      router.push('/');
    }
  }, [qrCode, router]);

  const handleProgress = (currentTime: number, duration: number) => {
    updateProgress(currentTime, duration);
  };

  const handleStateChange = (state: number) => {
    // YouTube states: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (video cued)
    setPlaying(state === 1);
    setLoading(state === 3);
    
    if (state === 0) {
      // Video ended
      showNotification('Video completed');
    }
  };

  const handleReady = () => {
    setLoading(false);
    showNotification('Video ready to play');
  };

  const handleError = (error: Error) => {
    setError(error.message);
    showNotification(`Error: ${error.message}`);
  };

  const showNotification = (msg: string) => {
    setMessage(msg);
    setShowMessage(true);
    setTimeout(() => setShowMessage(false), 3000);
  };

  if (!qrCode || !qrCode.videoID) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <CustomText
          text="No video data available. Redirecting..."
          fontSize={18}
          color="black"
        />
      </div>
    );
  }

  // Use YouTube ID from QR code, or fallback to videoID if youtubeId not available
  const youtubeVideoId = qrCode.youtubeId || qrCode.videoID;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-gray-900 text-white h-[70px] flex items-center justify-between px-4">
        <div className="flex items-center">
          <CustomButton
            text="← Back"
            onClick={onBack}
            fontSize={14}
          />
        </div>
        <div className="flex-1 flex justify-center">
          <CustomText
            text={qrCode.videoName || 'Video Player'}
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
          className="relative bg-black rounded-md w-full overflow-hidden"
          style={{ 
            maxWidth: '1000px', 
            aspectRatio: '16/9'
          }}
        >
          {videoState.loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-10">
              <CustomText
                text="Loading..."
                fontSize={18}
                color="white"
              />
            </div>
          )}
          
          <YouTubePlayer
            videoId={youtubeVideoId}
            onProgress={handleProgress}
            onStateChange={handleStateChange}
            onReady={handleReady}
            onError={handleError}
          />
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
              <CustomText
                text="5% Watched"
                fontSize={12}
                color={videoState.thresholds.fivePercent ? 'green' : 'gray'}
                bold={videoState.thresholds.fivePercent}
              />
            </div>
            <div className={`p-2 rounded ${videoState.thresholds.twentyPercent ? 'bg-green-100' : 'bg-gray-100'}`}>
              <CustomText
                text="20% Watched"
                fontSize={12}
                color={videoState.thresholds.twentyPercent ? 'green' : 'gray'}
                bold={videoState.thresholds.twentyPercent}
              />
            </div>
            <div className={`p-2 rounded ${videoState.thresholds.twentyFivePercent ? 'bg-green-100' : 'bg-gray-100'}`}>
              <CustomText
                text="25% Watched"
                fontSize={12}
                color={videoState.thresholds.twentyFivePercent ? 'green' : 'gray'}
                bold={videoState.thresholds.twentyFivePercent}
              />
            </div>
            <div className={`p-2 rounded ${videoState.thresholds.fortyPercent ? 'bg-green-100' : 'bg-gray-100'}`}>
              <CustomText
                text="40% Watched"
                fontSize={12}
                color={videoState.thresholds.fortyPercent ? 'green' : 'gray'}
                bold={videoState.thresholds.fortyPercent}
              />
            </div>
            <div className={`p-2 rounded ${videoState.thresholds.sixtyPercent ? 'bg-green-100' : 'bg-gray-100'}`}>
              <CustomText
                text="60% Watched"
                fontSize={12}
                color={videoState.thresholds.sixtyPercent ? 'green' : 'gray'}
                bold={videoState.thresholds.sixtyPercent}
              />
            </div>
            <div className={`p-2 rounded ${videoState.thresholds.eightyPercent ? 'bg-green-100' : 'bg-gray-100'}`}>
              <CustomText
                text="80% Watched"
                fontSize={12}
                color={videoState.thresholds.eightyPercent ? 'green' : 'gray'}
                bold={videoState.thresholds.eightyPercent}
              />
            </div>
            <div className={`p-2 rounded ${videoState.thresholds.ninetyFivePercent ? 'bg-green-100' : 'bg-gray-100'} col-span-2`}>
              <CustomText
                text="95% Watched"
                fontSize={12}
                color={videoState.thresholds.ninetyFivePercent ? 'green' : 'gray'}
                bold={videoState.thresholds.ninetyFivePercent}
              />
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