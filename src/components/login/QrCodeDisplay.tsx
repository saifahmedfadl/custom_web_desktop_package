'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import { CustomText } from '../common/CustomText';

// Dynamic import for QRCode to avoid SSR issues
const QRCode = dynamic(
  () => import('react-qr-code').then((mod) => mod.default),
  { 
    ssr: false,
    loading: () => <div className="animate-pulse bg-gray-200 w-[200px] h-[200px]"></div>
  }
);

interface QrCodeDisplayProps {
  qrId: string | null;
  polling: boolean;
}

export const QrCodeDisplay: React.FC<QrCodeDisplayProps> = ({ qrId, polling }) => {
  return (
    <div 
      className="border-2 border-gray-300 rounded-md p-4 mb-8 flex flex-col items-center justify-center"
      style={{ width: '250px', height: '250px' }}
    >
      {!qrId ? (
        <CustomText
          text="Click Generate QR Code"
          fontSize={14}
          color="gray"
        />
      ) : (
        <>
          <QRCode 
            value={qrId}
            size={200}
            level="H"
            className="mb-2"
          />
          {polling && (
            <div className="mt-2">
              <CustomText
                text="Waiting for scan..."
                fontSize={12}
                color="gray"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}; 