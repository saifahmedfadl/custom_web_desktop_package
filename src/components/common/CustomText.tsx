import React from 'react';
import { containsRTL } from '../../utils/formatting';

interface CustomTextProps {
  text: string;
  fontSize?: number;
  color?: string;
  alignment?: 'left' | 'center' | 'right';
  bold?: boolean;
  className?: string;
  direction?: 'rtl' | 'ltr';
}

export const CustomText: React.FC<CustomTextProps> = ({
  text,
  fontSize = 16,
  color = 'black',
  alignment = 'center',
  bold = false,
  className = '',
  direction,
}) => {
  // Auto-detect RTL text if direction not specified
  const textDirection = direction || (containsRTL(text) ? 'rtl' : 'ltr');

  return (
    <div
      className={`custom-text ${className}`}
      style={{
        color,
        fontSize: `${fontSize}px`,
        textAlign: alignment,
        direction: textDirection,
        fontWeight: bold ? 'bold' : 'normal',
      }}
    >
      {text}
    </div>
  );
}; 