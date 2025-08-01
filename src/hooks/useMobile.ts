import { useState, useEffect } from 'react';

export interface MobileState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  screenSize: 'small' | 'medium' | 'large';
  orientation: 'portrait' | 'landscape';
  touchSupported: boolean;
}

/**
 * Custom hook for mobile device detection and responsive behavior
 */
export const useMobile = (): MobileState => {
  const [mobileState, setMobileState] = useState<MobileState>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    screenSize: 'large',
    orientation: 'landscape',
    touchSupported: false,
  });

  useEffect(() => {
    const checkDeviceType = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // Device type detection
      const isMobile = width < 768;
      const isTablet = width >= 768 && width < 1024;
      const isDesktop = width >= 1024;
      
      // Screen size classification
      let screenSize: 'small' | 'medium' | 'large' = 'large';
      if (width < 576) screenSize = 'small';
      else if (width < 992) screenSize = 'medium';
      
      // Orientation detection
      const orientation = width > height ? 'landscape' : 'portrait';
      
      // Touch support detection
      const touchSupported = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      setMobileState({
        isMobile,
        isTablet,
        isDesktop,
        screenSize,
        orientation,
        touchSupported,
      });
    };

    // Initial check
    checkDeviceType();

    // Listen for resize events
    window.addEventListener('resize', checkDeviceType);
    window.addEventListener('orientationchange', checkDeviceType);

    return () => {
      window.removeEventListener('resize', checkDeviceType);
      window.removeEventListener('orientationchange', checkDeviceType);
    };
  }, []);

  return mobileState;
}; 