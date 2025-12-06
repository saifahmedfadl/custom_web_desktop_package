// TEMPORARILY DISABLED VERSION CHECK FUNCTIONALITY
// import { useCallback, useEffect, useState } from 'react';
// import { useApp } from '../context/AppContext';
// import { WindowsVersion } from '../models/QrModel';
// import { apiService } from '../services/api';
// import { firebaseService } from '../services/firebase';

export const useVersionCheck = (currentVersion: string) => {
  // Return dummy values that won't trigger update dialogs
  return {
    latestVersion: null,
    isCheckingVersion: false,
    versionError: null,
    showUpdateDialog: false,
    checkForUpdates: () => Promise.resolve(),
    closeUpdateDialog: () => {},
  };
};

/* Original implementation commented out:

// import { useCallback, useEffect, useState } from 'react';
// import { useApp } from '../context/AppContext';
// import { WindowsVersion } from '../models/QrModel';

// export const useVersionCheck = (currentVersion: string) => {
//   const { config } = useApp();
//   const [latestVersion, setLatestVersion] = useState<WindowsVersion | null>(null);
//   const [isCheckingVersion, setIsCheckingVersion] = useState<boolean>(false);
//   const [versionError, setVersionError] = useState<string | null>(null);
//   const [showUpdateDialog, setShowUpdateDialog] = useState<boolean>(false);

//   // const checkForUpdates = useCallback(async () => {
//   //   setIsCheckingVersion(true);
//   //   setVersionError(null);
    
//   //   try {
//   //     let versionInfo: WindowsVersion | null = null;
      
//   //     if (config?.usingApi) {
//   //       versionInfo = await apiService.checkVersion(currentVersion);
//   //     } else {
//   //       versionInfo = await firebaseService.checkVersion(currentVersion);
//   //     }
      
//   //     if (versionInfo) {
//   //       setLatestVersion(versionInfo);
        
//   //       // Compare versions
//   //       if (isNewerVersion(currentVersion, versionInfo.version)) {
//   //         setShowUpdateDialog(true);
//   //       }
//   //     }
//   //   } catch (error) {
//   //     setVersionError(error instanceof Error ? error.message : 'Unknown error checking for updates');
//   //     console.error('Error checking for updates', error);
//   //   } finally {
//   //     setIsCheckingVersion(false);
//   //   }
//   // }, [config, currentVersion]);

//   // Check for updates on initial load
//   // useEffect(() => {
//   //   checkForUpdates();
//   // }, [checkForUpdates]);

//   // const closeUpdateDialog = useCallback(() => {
//   //   setShowUpdateDialog(false);
//   // }, []);

//   // Helper function to compare versions (semver format: x.y.z)
//   // const isNewerVersion = (current: string, latest: string): boolean => {
//   //   if (current === latest) return false;
    
//   //   const currentParts = current.split('.').map(Number);
//   //   const latestParts = latest.split('.').map(Number);
    
//   //   for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
//   //     const currentPart = currentParts[i] || 0;
//   //     const latestPart = latestParts[i] || 0;
      
//   //     if (latestPart > currentPart) {
//   //       return true;
//   //     } else if (latestPart < currentPart) {
//   //       return false;
//   //     }
//   //   }
    
//   //   return false;
//   // };

//   // return {
//   //   latestVersion,
//   //   isCheckingVersion,
//   //   versionError,
//   //   showUpdateDialog,
//   //   checkForUpdates,
//   //   closeUpdateDialog,
//   // };
// }; 
*/ 