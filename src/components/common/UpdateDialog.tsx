import React from 'react';
import { WindowsVersion } from '../../models/QrModel';
import { CustomButton } from './CustomButton';
import { CustomText } from './CustomText';

interface UpdateDialogProps {
  version: WindowsVersion;
  currentVersion: string;
  forceUpdate: boolean;
  onUpdate: () => void;
  onCancel: () => void;
}

export const UpdateDialog: React.FC<UpdateDialogProps> = ({
  version,
  currentVersion,
  forceUpdate,
  onUpdate,
  onCancel,
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <div className="mb-4">
          <CustomText
            text="Update Available"
            fontSize={20}
            color="black"
            bold={true}
          />
        </div>
        
        <div className="mb-6">
          <CustomText
            text={`A new version (${version.version}) of the application is available. You are currently using version ${currentVersion}.`}
            fontSize={14}
            color="black"
          />
          
          {forceUpdate && (
            <div className="mt-2 p-2 bg-red-100 rounded">
              <CustomText
                text="This update is required to continue using the application."
                fontSize={14}
                color="red"
                bold={true}
              />
            </div>
          )}
        </div>
        
        <div className="flex justify-end gap-2">
          {!forceUpdate && (
            <CustomButton
              text="Cancel"
              onClick={onCancel}
              textColor="black"
              fontSize={14}
              className="bg-gray-200 hover:bg-gray-300"
            />
          )}
          
          <CustomButton
            text="Update Now"
            onClick={onUpdate}
            fontSize={14}
            bold={true}
          />
        </div>
      </div>
    </div>
  );
};
