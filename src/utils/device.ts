/**
 * FingerprintJS visualization-free implementation for stable device ID
 * This creates a highly stable device identifier that persists across sessions
 */

// Advanced fingerprinting components
const getCanvasFingerprint = (): string => {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'canvas-not-supported';
    
    // Draw something unique that will vary based on hardware/OS/Browser
    canvas.width = 200;
    canvas.height = 200;
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('TeacherApp', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('TeacherApp', 4, 17);
    
    return canvas.toDataURL();
  } catch (_e) {
    return 'canvas-error';
  }
};

const getSystemInfo = (): string => {
  const nav = window.navigator;
  const screen = window.screen;
  return [
    nav.userAgent,
    nav.language,
    screen.colorDepth,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    nav.hardwareConcurrency || 'unknown',
    (nav as any).deviceMemory || 'unknown',
    nav.platform || 'unknown',
    nav.vendor || 'unknown',
  ].join('|||');
};

const getAudioFingerprint = (): Promise<string> => {
  return new Promise((resolve) => {
    try {
      // @ts-ignore - Audio API variations across browsers
      const audioContext = window.AudioContext || window.webkitAudioContext;
      if (!audioContext) {
        resolve('audio-not-supported');
        return;
      }
      
      const context = new audioContext();
      const oscillator = context.createOscillator();
      const analyser = context.createAnalyser();
      const gain = context.createGain();
      
      oscillator.type = 'triangle';
      oscillator.connect(analyser);
      analyser.connect(gain);
      gain.connect(context.destination);
      
      gain.gain.value = 0; // Mute the sound
      oscillator.start(0);
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);
      
      // Convert the audio data to a string
      const audioData = Array.from(dataArray).slice(0, 5).join(',');
      
      oscillator.stop();
      context.close();
      
      resolve(audioData);
    } catch (_e) {
      resolve('audio-error');
    }
  });
};

/**
 * Advanced hash function that produces more consistent results
 */
const hashCode = (str: string): string => {
  let hash = 0;
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Only use the hash, no timestamp to ensure consistency
  return Math.abs(hash).toString(16).padStart(8, '0');
};

/**
 * Generates a highly stable device ID based on multiple browser features
 */
export const generateDeviceId = async (): Promise<string> => {
  try {
    // Collect multiple fingerprinting components
    const systemInfo = getSystemInfo();
    const canvasFingerprint = getCanvasFingerprint();
    const audioFingerprint = await getAudioFingerprint();
    
    // Local storage test as an additional signal
    let storageAvailable = 'unknown';
    try {
      localStorage.setItem('test', 'test');
      localStorage.removeItem('test');
      storageAvailable = 'available';
    } catch (_e) {
      storageAvailable = 'unavailable';
    }
    
    // WebGL fingerprinting
    let webglFingerprint = 'webgl-unknown';
    try {
      const canvas = document.createElement('canvas');
      // Type cast to WebGL context
      const gl = canvas.getContext('webgl') as WebGLRenderingContext || canvas.getContext('experimental-webgl') as WebGLRenderingContext;
      if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          webglFingerprint = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) + '/' + gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        }
      }
    } catch (_e) {
      webglFingerprint = 'webgl-error';
    }
    
    // Combine all fingerprints for a highly stable ID
    const combinedFingerprint = [
      systemInfo,
      canvasFingerprint,
      audioFingerprint,
      storageAvailable,
      webglFingerprint
    ].join('####');
    
    return hashCode(combinedFingerprint);
  } catch (error) {
    // Fallback in case of errors
    console.error('Error generating device ID:', error);
    return hashCode(navigator.userAgent + Math.random().toString());
  }
};

/**
 * Retrieves the device ID from localStorage or generates a new one
 * Uses an advanced fingerprinting technique for stability
 */
export const getDeviceId = (): string => {
  const storageKey = 'teacher_app_device_id';
  const deviceId = localStorage.getItem(storageKey);
  
  if (!deviceId) {
    // We need to handle the async nature of generateDeviceId
    // For the first call, return a temporary ID and then update it
    const tempId = hashCode(navigator.userAgent);
    localStorage.setItem(storageKey, tempId);
    
    // Generate the real fingerprint and update storage
    generateDeviceId().then(realId => {
      localStorage.setItem(storageKey, realId);
      console.log('Permanent device ID generated:', realId);
    });
    
    return tempId;
  }
  
  return deviceId;
}; 