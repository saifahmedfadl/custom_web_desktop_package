'use client';

import { useRouter } from 'next/navigation';
import React from 'react';
import { useApp } from '../../context/AppContext';
import { CustomButton } from '../common/CustomButton';
import { CustomText } from '../common/CustomText';

export const VideoView: React.FC = () => {
  const router = useRouter();
  const { qrCode, resetQrCodeData } = useApp();

  // Handle back button click
  // Handle back button click
  // Handle back button click
  // Handle back button click
  // Handle back button click
  // Handle back button click
  // Handle back button click
  const handleBackClick = () => {
    // Completely reset QR code data before navigating back
    resetQrCodeData();
    // Navigate back to the home page
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

  // Use YouTube ID from QR code, or fallback to videoID if youtubeId not available
  const youtubeVideoId = qrCode.youtubeId || qrCode.videoID;

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
          className="relative bg-black rounded-md w-full overflow-hidden shadow-lg"
          style={{ 
            maxWidth: '1000px', 
            aspectRatio: '16/9'
          }}
        >
          <iframe 
            src={`https://youtube-iframe-pi.vercel.app/embed.html?videoId=${youtubeVideoId}`}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="YouTube Video Player"
          />
        </div>
        
    
      </div>
    </div>
  );
};
