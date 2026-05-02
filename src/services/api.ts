import axios, { AxiosInstance } from 'axios';
import { QrModelWindows } from '../models/QrModel';
import { firebaseService } from './firebase';

export interface QrEventHandlers {
  onUpdate: (qr: QrModelWindows) => void;
  onDone?: (qr: QrModelWindows) => void;
  onTimeout?: () => void;
  onError?: (err: Error) => void;
}

export interface QrEventSubscription {
  close: () => void;
}

// Mirror of the resolved-check used by the QR consumer (LoginController /
// useQrCode). Centralized here so subscribeToQrUpdates can fire `onDone`
// the moment the doc is actionable, instead of waiting on the consumer.
function qrIsResolved(data: QrModelWindows | null | undefined): boolean {
  if (!data) return false;
  if ((data as any).isUsed === true) return true;
  if (data.videoID && data.videoID.length > 0) return true;
  if (data.youtubeId && data.youtubeId.length > 0) return true;
  if (data.videoUrl && data.videoUrl.length > 0) return true;
  const vm = data.videoModel as any;
  if (vm?.hlsVideo && vm.hlsVideo.length > 0) return true;
  if (vm?.hls_video && vm.hls_video.length > 0) return true;
  if (vm?.webmVideo && vm.webmVideo.length > 0) return true;
  if (vm?.webm_video && vm.webm_video.length > 0) return true;
  if (vm?.mp4_video && vm.mp4_video.length > 0) return true;
  return false;
}

class ApiService {
  private api: AxiosInstance | null = null;
  private baseUrl: string = '';
  private proxyUrl: string = '/api';
  private currentVersion: string = '1.0.0';

  initialize(baseUrl: string, version?: string): void {
    if (version) {
      this.currentVersion = version;
    }
    // Always use the Next.js API route to avoid CORS issues on both local and production
    // This works with our next.config.js rewrites configuration
    this.proxyUrl = '/api';

    this.baseUrl = baseUrl; // Keep the original for reference
    this.api = axios.create({
      baseURL: this.proxyUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        // This custom header helps with our conditional rewrite rules
        'x-invoke-proxy': '1'
      }
    });
    console.log(`API service initialized with base URL: ${baseUrl} (via proxy)`);
  }

  // QR Code Related Methods
  async createQrCode(deviceId: string): Promise<QrModelWindows | null> {
    if (!this.api) {
      console.error('API not initialized');
      return null;
    }
    
    console.log('api is initialized in createQrCode');
    try {
      // Match the endpoint and request format from Flutter
      //delay for 1 second
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('Creating QR code... deviceId: ', deviceId);
      const response = await this.api.post('/createNewQr', { 
        deviceID: deviceId 
      });
      
      console.log('QR code created:', response.data);
      return response.data; // Return the full QR model, not just the ID
    } catch (error) {
      console.error('Error creating QR code via API', error);
      return null;
    }
  }

  async getQrCodeStatus(qrId: string): Promise<QrModelWindows | null> {
    if (!this.api) return null;

    try {
      // Match the endpoint from Flutter - uses query param instead of path param
      const response = await this.api.get(`/getQrData?id=${qrId}`);
      console.log('QR code status in api ts:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error getting QR code status via API', error);
      return null;
    }
  }

  /**
   * Subscribe to QR updates via Firestore `onSnapshot` (no polling, no
   * long-running cloud function). Internally:
   *   1. firebaseService bootstraps the web SDK on first call (fetching
   *      config from /api/firebaseConfig — see functions index.js).
   *   2. We attach an onSnapshot listener to qrWindows/{qrId}.
   *   3. Every doc change → handlers.onUpdate(data).
   *   4. When the QR is resolved (video attached / isUsed) → handlers.onDone
   *      fires AND we auto-close the listener.
   *
   * `onTimeout` is kept on the handler interface for backward compat with
   * the prior SSE implementation but is never invoked here — Firestore
   * onSnapshot has no server-side stream timeout.
   *
   * The returned `close()` MUST be called when the caller is done; otherwise
   * the listener stays active and continues to bill Firestore reads.
   */
  subscribeToQrUpdates(qrId: string, handlers: QrEventHandlers): QrEventSubscription {
    let unsubscribe: (() => void) | null = null;
    let closed = false;

    const close = () => {
      if (closed) return;
      closed = true;
      if (unsubscribe) {
        try { unsubscribe(); } catch (_) { /* noop */ }
        unsubscribe = null;
      }
    };

    firebaseService
      .subscribeToQrCode(
        qrId,
        (data) => {
          if (closed) return;
          handlers.onUpdate(data);
          if (qrIsResolved(data)) {
            handlers.onDone?.(data);
            close();
          }
        },
        (err) => {
          if (closed) return;
          handlers.onError?.(err);
          close();
        },
      )
      .then((unsub) => {
        // Caller may have already closed before bootstrap finished.
        if (closed) {
          try { unsub(); } catch (_) { /* noop */ }
        } else {
          unsubscribe = unsub;
        }
      })
      .catch((err) => {
        if (!closed) handlers.onError?.(err instanceof Error ? err : new Error(String(err)));
      });

    return { close };
  }

  // Version Checking - match the endpoint and format from Flutter
  // async checkVersion(): Promise<{updateRequired: boolean, url: string} | null> {
  //   if (!this.api) return null;
    
  //   try {
  //     const response = await this.api.post('/checkVersion', {
  //       version: this.currentVersion
  //     });
      
  //     return {
  //       updateRequired: response.data.updateRequired,
  //       url: response.data.url
  //     };
  //   } catch (error) {
  //     console.error('Error checking version via API', error);
  //     return null;
  //   }
  // }

  /**
   * Session-start signal — bumps `entryCounter` by 1 once the student has
   * stayed on the video long enough (the caller handles the 4-min delay,
   * matching Flutter `increaseEntryCounter`).
   */
  async incrementVideoEntryCounter(userUuid: string, videoId: string): Promise<boolean> {
    if (!this.api) return false;
    try {
      await this.api.post('/incrementVideoEntry', { userUuid, videoId });
      return true;
    } catch (error) {
      console.error('Error incrementing entryCounter via API', error);
      return false;
    }
  }

  /**
   * Student Progress Tracking — v2 schema.
   *
   * Posts the same payload the Flutter app writes from `_flushProgress`:
   *   - maxPercent          (0-100)
   *   - totalWatchSeconds   (real watch time)
   *   - timeFinish          (legacy 5%-step checkpoints, kept for old teacher UI)
   *
   * Server stamps `lastWatchedAt` with FieldValue.serverTimestamp() so the
   * value is always trusted server-time even if the desktop clock is wrong.
   */
  async updateVideoProgress(
    userUuid: string,
    videoId: string,
    subtitle: string,
    maxPercent: number,
    totalWatchSeconds: number,
    legacyThresholds: string[],
  ): Promise<boolean> {
    if (!this.api) return false;

    try {
      await this.api.post('/updateProgress', {
        userUuid,
        videoId,
        subtitle,
        maxPercent,
        totalWatchSeconds,
        timeFinish: legacyThresholds,
      });
      return true;
    } catch (error) {
      console.error('Error updating video progress via API', error);
      return false;
    }
  }
}

export const apiService = new ApiService();

// Define endpoints class to match Flutter implementation
export class Endpoints {
  static readonly checkVersion = '/checkVersion';
  static readonly createNewQr = '/createNewQr';
  static readonly getQrData = '/getQrData';
  static readonly firebaseConfig = '/firebaseConfig';
  static readonly updateProgress = '/updateProgress';
  static readonly incrementVideoEntry = '/incrementVideoEntry';
}