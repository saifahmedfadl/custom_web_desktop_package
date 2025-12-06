import axios, { AxiosInstance } from 'axios';
import { QrModelWindows } from '../models/QrModel';

class ApiService {
  private api: AxiosInstance | null = null;
  private baseUrl: string = '';
  private currentVersion: string = '1.0.0';

  initialize(baseUrl: string, version?: string): void {
    if (version) {
      this.currentVersion = version;
    }
    // Always use the Next.js API route to avoid CORS issues on both local and production
    // This works with our next.config.js rewrites configuration
    const proxyUrl = '/api';
    
    this.baseUrl = baseUrl; // Keep the original for reference
    this.api = axios.create({
      baseURL: proxyUrl,
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

  // Student Progress Tracking - Match Flutter implementation
  async updateVideoProgress(
    userUuid: string,
    videoId: string,
    subtitle: string,
    progress: number
  ): Promise<boolean> {
    if (!this.api) return false;
    
    try {
      await this.api.post('/updateProgress', {
        userUuid,
        videoId,
        subtitle,
        progress
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
  static readonly updateProgress = '/updateProgress';
}