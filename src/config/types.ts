// Configuration types for the teacher web desktop package

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export interface AssetsConfig {
  logo: string;
  background: string;
}

export interface TeacherAppConfig {
  // API Configuration
  apiBaseUrl?: string;
  baseUrl?: string; // Alias for apiBaseUrl for compatibility
  
  // App Identity
  nameAdmin: string;
  appName?: string;
  version?: string;
  
  // Theme
  primaryColor?: string;
  secondaryColor?: string;
  
  // Features
  watchedOffline?: boolean;
  usingApi?: boolean;
  
  // Firebase (optional - can be configured separately)
  firebase?: FirebaseConfig;
  initializeFirebase?: () => void; // For compatibility
  
  // Assets paths (relative to public folder)
  assets?: AssetsConfig;
  logo?: string;
  backgroundImage?: string;
}

// Default configuration that can be overridden
export const defaultConfig: Partial<TeacherAppConfig> = {
  primaryColor: '#6B7280',
  watchedOffline: false,
  usingApi: true,
  version: '1.0.0',
};
