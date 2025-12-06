import React from 'react';
import { CustomText } from './CustomText';

interface CustomButtonProps {
  text: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  textColor?: string;
  fontSize?: number;
  bold?: boolean;
  fullWidth?: boolean;
  borderRadius?: number;
  padding?: string;
  iconLeft?: React.ReactNode;
  backgroundColor?: string;
}

export const CustomButton: React.FC<CustomButtonProps> = ({
  text,
  onClick,
  disabled = false,
  className = '',
  textColor = 'white',
  fontSize = 16,
  bold = false,
  fullWidth = false,
  borderRadius = 8,
  padding = '10px 20px',
  iconLeft,
  backgroundColor,
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`custom-button ${className} ${fullWidth ? 'w-full' : ''}`}
      style={{
        backgroundColor: disabled ? '#cccccc' : (backgroundColor || '#374151'),
        borderRadius: `${borderRadius}px`,
        padding,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background-color 0.3s ease',
        opacity: disabled ? 0.7 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
      }}
    >
      {iconLeft && <span>{iconLeft}</span>}
      <CustomText
        text={text}
        color={textColor}
        fontSize={fontSize}
        bold={bold}
      />
    </button>
  );
};
