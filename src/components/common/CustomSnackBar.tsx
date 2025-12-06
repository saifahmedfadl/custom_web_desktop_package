import React, { useEffect, useState } from 'react';
import { CustomText } from './CustomText';

interface CustomSnackBarProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onClose?: () => void;
  visible?: boolean;
}

export const CustomSnackBar: React.FC<CustomSnackBarProps> = ({
  message,
  type = 'info',
  duration = 3000,
  onClose,
  visible = true,
}) => {
  const [isVisible, setIsVisible] = useState(visible);

  useEffect(() => {
    setIsVisible(visible);
    
    if (visible && duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        if (onClose) onClose();
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [visible, duration, onClose]);

  if (!isVisible) return null;

  const backgroundColor = {
    success: '#4CAF50',
    error: '#F44336',
    info: '#2196F3',
  }[type];

  return (
    <div
      className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50"
      style={{
        backgroundColor,
        padding: '10px 20px',
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }}
    >
      <CustomText text={message} color="white" fontSize={14} />
    </div>
  );
}; 