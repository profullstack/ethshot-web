// Device detection utilities for mobile/desktop differentiation

/**
 * Detects if the current device is mobile based on user agent and screen size
 * @returns {boolean} True if mobile device, false otherwise
 */
export const isMobile = () => {
  if (typeof window === 'undefined') return false;
  
  // Check user agent for mobile indicators (excluding iPad to be more conservative)
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  const mobileRegex = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i;
  const isMobileUserAgent = mobileRegex.test(userAgent.toLowerCase());
  
  // Check screen size (mobile typically < 480px width for phones)
  const isMobileScreen = window.innerWidth < 480;
  
  // Check for touch capability
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Return true only if user agent indicates mobile OR (small screen AND touch)
  return isMobileUserAgent || (isMobileScreen && isTouchDevice);
};

/**
 * Detects if the current device is desktop
 * @returns {boolean} True if desktop device, false otherwise
 */
export const isDesktop = () => {
  return !isMobile();
};

/**
 * Detects if the current device is tablet
 * @returns {boolean} True if tablet device, false otherwise
 */
export const isTablet = () => {
  if (typeof window === 'undefined') return false;
  
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  const tabletRegex = /ipad|android(?!.*mobile)|tablet/i;
  const isTabletUserAgent = tabletRegex.test(userAgent.toLowerCase());
  
  // Check screen size (tablet typically 768px - 1024px width)
  const isTabletScreen = window.innerWidth >= 768 && window.innerWidth <= 1024;
  
  return isTabletUserAgent || isTabletScreen;
};

/**
 * Gets device type as string
 * @returns {'mobile' | 'tablet' | 'desktop'} Device type
 */
export const getDeviceType = () => {
  if (isMobile()) return 'mobile';
  if (isTablet()) return 'tablet';
  return 'desktop';
};