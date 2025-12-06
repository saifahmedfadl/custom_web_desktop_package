import { FirebaseApp, initializeApp } from 'firebase/app';
import {
    Firestore,
    Unsubscribe,
    collection,
    doc,
    getDoc,
    getDocs,
    getFirestore,
    onSnapshot,
    setDoc,
    updateDoc
} from 'firebase/firestore';
import { FirebaseConfig } from '../config/types';
import { QrModelWindows, StudentData, WindowsVersion } from '../models/QrModel';

class FirebaseService {
  private app: FirebaseApp | null = null;
  private db: Firestore | null = null;

  initialize(config: FirebaseConfig): void {
    try {
      this.app = initializeApp(config);
      this.db = getFirestore(this.app);
      console.log('Firebase initialized successfully');
    } catch (error) {
      console.error('Error initializing Firebase', error);
    }
  }

  isInitialized(): boolean {
    return this.db !== null;
  }

  // QR Code Related Methods
  async createQrCode(deviceId: string): Promise<string | null> {
    if (!this.db) return null;
    
    try {
      const qrId = `qr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const qrData: QrModelWindows = {
        id: qrId,
        deviceID: deviceId,
        createdAt: new Date().toISOString()
      };
      
      await setDoc(doc(this.db, 'qrWindows', qrId), qrData);
      return qrId;
    } catch (error) {
      console.error('Error creating QR code firebase', error);
      return null;
    }
  }

  subscribeToQrCode(qrId: string, onUpdate: (data: QrModelWindows) => void): Unsubscribe | null {
    if (!this.db) return null;
    
    try {
      return onSnapshot(doc(this.db, 'qrWindows', qrId), (docSnapshot) => {
        if (docSnapshot.exists()) {
          onUpdate(docSnapshot.data() as QrModelWindows);
        }
      });
    } catch (error) {
      console.error('Error subscribing to QR code', error);
      return null;
    }
  }

  // Version Checking
  async checkVersion(currentVersion: string): Promise<WindowsVersion | null> {
    if (!this.db) return null;
    
    try {
      const versionSnapshot = await getDocs(collection(this.db, 'windowsVersion'));
      
      if (!versionSnapshot.empty) {
        return versionSnapshot.docs[0].data() as WindowsVersion;
      }
      
      return null;
    } catch (error) {
      console.error('Error checking version', error);
      return null;
    }
  }

  // Student Progress Tracking
  async updateVideoProgress(
    userUuid: string, 
    videoId: string, 
    subtitle: string,
    threshold: number
  ): Promise<boolean> {
    if (!this.db) return false;
    
    try {
      const studentRef = doc(this.db, 'student', userUuid);
      const studentDoc = await getDoc(studentRef);
      
      if (studentDoc.exists()) {
        const studentData = studentDoc.data() as StudentData;
        const videoProgress = studentData.seenVideos[videoId] || {
          entryCounter: 0,
          timeFinish: [],
          subtitle
        };
        
        // Increment entry counter if this is a new threshold
        if (!videoProgress.timeFinish.includes(threshold.toString())) {
          videoProgress.entryCounter += 1;
          videoProgress.timeFinish.push(threshold.toString());
          
          await updateDoc(studentRef, {
            [`seenVideos.${videoId}`]: videoProgress
          });
        }
        
        return true;
      } else {
        // Create new student document
        const newStudentData: StudentData = {
          seenVideos: {
            [videoId]: {
              entryCounter: 1,
              timeFinish: [threshold.toString()],
              subtitle
            }
          }
        };
        
        await setDoc(studentRef, newStudentData);
        return true;
      }
    } catch (error) {
      console.error('Error updating video progress', error);
      return false;
    }
  }
}

export const firebaseService = new FirebaseService();
