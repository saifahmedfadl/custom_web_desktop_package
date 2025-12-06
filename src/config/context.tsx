'use client';

import { ReactNode, createContext, useContext } from 'react';
import { TeacherAppConfig, defaultConfig } from './types';

// Create the context
const ConfigContext = createContext<TeacherAppConfig | null>(null);

// Provider component
interface ConfigProviderProps {
  config: TeacherAppConfig;
  children: ReactNode;
}

export function ConfigProvider({ config, children }: ConfigProviderProps) {
  // Merge with defaults
  const mergedConfig: TeacherAppConfig = {
    ...defaultConfig,
    ...config,
  } as TeacherAppConfig;

  return (
    <ConfigContext.Provider value={mergedConfig}>
      {children}
    </ConfigContext.Provider>
  );
}

// Hook to use the config
export function useConfig(): TeacherAppConfig {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
}

// Hook to get specific config values
export function useApiBaseUrl(): string {
  const config = useConfig();
  return config.apiBaseUrl || config.baseUrl || '';
}

export function useAppConfig() {
  const config = useConfig();
  return {
    primaryColor: config.primaryColor,
    nameAdmin: config.nameAdmin,
    watchedOffline: config.watchedOffline,
    usingApi: config.usingApi,
    version: config.version,
  };
}
