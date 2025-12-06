/**
 * Formats text according to specified alignment and direction
 */
export const formatText = (
  text: string,
  direction: 'rtl' | 'ltr' = 'ltr',
  alignment: 'left' | 'right' | 'center' = 'left'
): { text: string; style: React.CSSProperties } => {
  return {
    text,
    style: {
      direction,
      textAlign: alignment,
    },
  };
};

/**
 * Detects if text contains RTL characters
 */
export const containsRTL = (text: string): boolean => {
  const rtlChars = /[\u0591-\u07FF\u200F\u202B\u202E\uFB1D-\uFDFD\uFE70-\uFEFC]/;
  return rtlChars.test(text);
};

/**
 * Formats timestamps for video progress
 */
export const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) {
    return '00:00';
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

/**
 * Formats percentage for video progress
 */
export const formatPercentage = (value: number, decimals: number = 0): string => {
  if (isNaN(value) || value < 0) {
    return '0%';
  }
  
  const percentage = Math.min(100, Math.max(0, value));
  return `${percentage.toFixed(decimals)}%`;
}; 