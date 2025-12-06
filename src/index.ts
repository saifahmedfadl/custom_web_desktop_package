// Main entry point for the teacher web desktop package

// Config exports
export * from './config';
export { ConfigProvider, useApiBaseUrl, useAppConfig, useConfig } from './config/context';
export type { AssetsConfig, FirebaseConfig, TeacherAppConfig } from './config/types';

// Context exports
export { AppProvider, useApp } from './context';
export type { AppProviderProps } from './context';

// Components exports
export * from './components';

// Hooks exports
export * from './hooks';

// Services exports
export { Endpoints, apiService, firebaseService, networkService } from './services';

// Models exports
export * from './models';

// Utils exports
export * from './utils';
