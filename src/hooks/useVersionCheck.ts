// Version check hook - currently disabled
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
