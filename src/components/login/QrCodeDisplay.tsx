import { QRCodeSVG } from 'qrcode.react';
import React from 'react';
import { CustomText } from '../common/CustomText';

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
          <QRCodeSVG 
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
