'use client';

import Image, { StaticImageData } from 'next/image';
import React from 'react';
import { useApp } from '../../context/AppContext';
import { CustomButton } from '../common/CustomButton';
import { CustomText } from '../common/CustomText';
import { QrCodeDisplay } from './QrCodeDisplay';

interface LoginViewProps {
  deviceId: string;
  qrId: string | null;
  polling: boolean;
  onGenerateQrCode: () => void;
  onRetryQrCode: () => void;
  version?: string;
  logo: StaticImageData;
  background: StaticImageData;
}

export const LoginView: React.FC<LoginViewProps> = ({
  qrId,
  polling,
  onRetryQrCode,
  version = '0.1.0',
  logo,
  background,
}) => {
  const { error, isLoading } = useApp();
  // استخدام isLoading من AppContext بدلاً من حالة محلية

  // // Generate QR code only once when component mounts
  // useEffect(() => {
  //   const initializeQrCode = async () => {
  //     try {
  //       // Add a small delay for better user experience
  //       await new Promise(resolve => setTimeout(resolve, 500));
  //       // Use onGenerateQrCode instead of onRetryQrCode for initial load
  //       await onGenerateQrCode();
  //     } catch (err) {
  //       console.error('Error initializing QR code:', err);
  //     } finally {
  //       setIsInitializing(false);
  //     }
  //   };

  //   initializeQrCode();
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, []);

  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden flex" style={{ height: '80vh', width: '80vw' }}>
      {/* Left Panel */}
      <div 
        className="text-white p-8 flex flex-col justify-center items-center relative"
        style={{ 
          backgroundColor: '#333333',
          backgroundImage: `url(${background.src})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundBlendMode: 'overlay',
          width: '50%',
        }}
      >
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ position: 'relative', width: '144px', height: '144px', marginBottom: '1rem' }}>
            <Image
              src={logo}
              alt="تطبيق المعلم"
              fill
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>
        </div>
        <div className="mb-4">
          <CustomText
            text="تعليمات تسجيل"
            fontSize={18}
            color="white"
            bold={true}
          />
        </div>
        <div className="mb-8">
          <CustomText
            text= "1- ادخل علي الفيديو الذي تريد مشاهدته"
            fontSize={14}
            color="white"
            direction="rtl"
            //padding
            className="mb-2"
          />
          <CustomText
            text= "2- اضغط علي ⋮ اعلي الفيديو علي اليمين"
            fontSize={14}
            color="white"
            direction="rtl"
            className="mb-2"
          />
          <CustomText
            text= "3- اضغط علي مشاهدة الفيديو علي الكمبيوتر"
            fontSize={14}
            color="white"
            direction="rtl"
            className="mb-2"
          />
          <CustomText
            text=   "4- عند فتح الكاميره قبل بعمل سكان للكود"
            fontSize={14}
            color="white"
            direction="rtl"
            className="mb-2"
          />
        </div>
        <div className="mt-auto">
         
          <CustomText
            text={`الإصدار: ${version}`}
            fontSize={12}
            color="gray"
          />
        </div>
      </div>

      {/* Right Panel */}
      <div style={{ width: '50%', backgroundColor: 'white', padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ marginBottom: '2rem' }}>
          <CustomText
            text={isLoading ? "جاري التحميل..." : error ? "حدث خطأ" : "يرجى مسح رمز QR"}
            fontSize={18}
            color={error ? "red" : "black"}
            bold={true}
          />
        </div>
        
        {isLoading ? (
          <div className="h-[300px] w-[300px] flex items-center justify-center bg-gray-100 rounded-lg">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-gray-900"></div>
          </div>
        ) : error ? (
          <div className="h-[300px] w-[300px] flex flex-col items-center justify-center bg-red-50 rounded-lg">
            <div className="text-red-500 text-5xl mb-4">⚠️</div>
            <CustomText
              text={error}
              fontSize={13}
              color="red"
            />
          </div>
        ) : (
          <QrCodeDisplay qrId={qrId} polling={polling} />
        )}
        
        {!isLoading &&error && (
          <CustomButton
            text={error || !qrId ? "إعادة المحاولة" : "تحديث رمز QR"}
            onClick={onRetryQrCode}
            disabled={polling && !error}
            //padding
            className="mt-4"
          />
        )}
      </div>
    </div>
  );
}; 