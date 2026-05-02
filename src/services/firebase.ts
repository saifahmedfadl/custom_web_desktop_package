import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import {
  Firestore,
  Unsubscribe,
  collection,
  doc,
  getDocs,
  getFirestore,
  increment,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { QrModelWindows, WindowsVersion } from '../models/QrModel';

/**
 * Firebase web SDK config — same shape Firebase emits for any web app.
 * Loaded at runtime from the Cloud Functions /firebaseConfig endpoint
 * so individual desktop projects don't have to bake values into env.
 */
export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  databaseURL?: string;
  measurementId?: string;
}

class FirebaseService {
  private app: FirebaseApp | null = null;
  private db: Firestore | null = null;
  // Single in-flight bootstrap promise — concurrent callers must all
  // await the same fetch, not race to create duplicate Firebase apps.
  private bootstrapPromise: Promise<Firestore> | null = null;
  private configUrl: string = '/api/firebaseConfig';

  /**
   * Override the URL used to fetch the web SDK config. Defaults to the
   * Next.js proxy path `/api/firebaseConfig` (matches the rewrite rule
   * the rest of the API uses). Call before the first subscription.
   */
  setConfigUrl(url: string): void {
    this.configUrl = url;
  }

  /**
   * Lazy bootstrap. The first caller fetches the config and registers
   * the Firebase app; subsequent callers reuse the same instance. On
   * fetch/init failure we drop the cached promise so a later call can
   * retry — important for transient network errors at startup.
   */
  private async ensureReady(): Promise<Firestore> {
    if (this.db) return this.db;
    if (this.bootstrapPromise) return this.bootstrapPromise;

    this.bootstrapPromise = (async () => {
      const res = await fetch(this.configUrl, { credentials: 'omit' });
      if (!res.ok) {
        throw new Error(`firebaseConfig endpoint returned ${res.status}`);
      }
      const config = (await res.json()) as FirebaseWebConfig;

      // initializeApp throws on duplicate names — reuse if a previous
      // call already registered the default app (HMR / multi-mount).
      const existing = getApps();
      this.app = existing.length > 0 ? existing[0] : initializeApp(config);
      this.db = getFirestore(this.app);
      return this.db;
    })();

    try {
      return await this.bootstrapPromise;
    } catch (err) {
      this.bootstrapPromise = null;
      throw err;
    }
  }

  /**
   * Subscribe to a single QR doc via Firestore onSnapshot.
   *
   * Returns a Promise that resolves to an `Unsubscribe` function. The
   * promise resolves once Firebase has been bootstrapped and the
   * listener attached. Callers MUST invoke the returned Unsubscribe
   * when done, otherwise the listener stays open forever.
   *
   * onError fires for both bootstrap failures (config fetch / init)
   * and runtime snapshot errors (permission denied, network drop).
   */
  async subscribeToQrCode(
    qrId: string,
    onUpdate: (data: QrModelWindows) => void,
    onError?: (err: Error) => void,
  ): Promise<Unsubscribe> {
    let db: Firestore;
    try {
      db = await this.ensureReady();
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
      return () => {};
    }

    return onSnapshot(
      doc(db, 'qrWindows', qrId),
      (snap) => {
        if (snap.exists()) {
          onUpdate(snap.data() as QrModelWindows);
        }
      },
      (err) => {
        console.error('qr onSnapshot error', err);
        onError?.(err);
      },
    );
  }

  // QR Code Related Methods
  async createQrCode(deviceId: string): Promise<string | null> {
    try {
      const db = await this.ensureReady();
      const qrId = `qr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const qrData: QrModelWindows = {
        id: qrId,
        deviceID: deviceId,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'qrWindows', qrId), qrData);
      return qrId;
    } catch (error) {
      console.error('Error creating QR code firebase', error);
      return null;
    }
  }

  // Version Checking
  async checkVersion(_currentVersion: string): Promise<WindowsVersion | null> {
    try {
      const db = await this.ensureReady();
      const versionSnapshot = await getDocs(collection(db, 'windowsVersion'));
      if (!versionSnapshot.empty) {
        return versionSnapshot.docs[0].data() as WindowsVersion;
      }
      return null;
    } catch (error) {
      console.error('Error checking version', error);
      return null;
    }
  }

  /**
   * Session-start signal: bumps `seenVideos.<videoId>.entryCounter` by 1.
   * Mirrors the Flutter `increaseEntryCounter` flow — fired once per video
   * session after the student has been on the page long enough to count as
   * a real view (the caller is responsible for the 4-minute delay).
   */
  async incrementVideoEntryCounter(userUuid: string, videoId: string): Promise<boolean> {
    if (!userUuid || !videoId) return false;
    try {
      const db = await this.ensureReady();
      const studentRef = doc(db, 'student', userUuid);
      await updateDoc(studentRef, {
        [`seenVideos.${videoId}.entryCounter`]: increment(1),
      });
      return true;
    } catch (error) {
      console.error('Error incrementing entryCounter', error);
      return false;
    }
  }

  /**
   * Student Progress Tracking — v2 schema.
   *
   * Mirrors the Flutter `_flushProgress` write: a single dotted-field
   * update so older entries are preserved and we don't have to round-trip
   * the whole student doc.
   *
   * `entryCounter` is intentionally NOT bumped here — that's a separate
   * "session start" signal handled by `incrementVideoEntryCounter`.
   */
  async updateVideoProgress(
    userUuid: string,
    videoId: string,
    subtitle: string,
    maxPercent: number,
    totalWatchSeconds: number,
    legacyThresholds: string[],
  ): Promise<boolean> {
    if (!userUuid || !videoId) return false;

    try {
      const db = await this.ensureReady();
      const studentRef = doc(db, 'student', userUuid);
      await setDoc(
        studentRef,
        {
          seenVideos: {
            [videoId]: {
              subtitle,
              maxPercent,
              totalWatchSeconds,
              lastWatchedAt: new Date().toISOString(),
              timeFinish: legacyThresholds,
            },
          },
        },
        { merge: true },
      );
      return true;
    } catch (error) {
      console.error('Error updating video progress', error);
      return false;
    }
  }
}

export const firebaseService = new FirebaseService();
