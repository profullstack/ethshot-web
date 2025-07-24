/**
 * External Links Utility
 * 
 * Provides functions to handle external link opening, especially for breaking out
 * of webviews on iOS devices (like MetaMask, Trust Wallet, etc.)
 */

/**
 * Detects if the current device is an iOS device
 * @returns {boolean} True if running on iOS (iPhone, iPad, iPod)
 */
export const isIOSDevice = () => {
  if (typeof navigator === 'undefined' || !navigator.userAgent) {
    return false;
  }
  
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
};

/**
 * Detects if the current browser is running inside a webview
 * (like MetaMask, Trust Wallet, Coinbase Wallet, etc.)
 * @returns {boolean} True if running in a webview
 */
export const isInWebview = () => {
  if (typeof navigator === 'undefined' || !navigator.userAgent) {
    return false;
  }
  
  const userAgent = navigator.userAgent;
  
  // Check for specific wallet webviews
  const walletWebviews = [
    'MetaMaskMobile',
    'Trust',
    'CoinbaseWallet',
    'Rainbow',
    'imToken',
    'TokenPocket'
  ];
  
  // Check for generic webview indicators
  const webviewIndicators = [
    'wv', // Android WebView
    'WebView', // Generic WebView
    'Mobile/', // iOS WebView without Safari
  ];
  
  // Check if it's NOT Safari (Safari has 'Safari' in user agent)
  const isSafari = userAgent.includes('Safari') && userAgent.includes('Version');
  
  if (isSafari) {
    return false; // Real Safari, not a webview
  }
  
  // Check for wallet-specific webviews
  for (const wallet of walletWebviews) {
    if (userAgent.includes(wallet)) {
      return true;
    }
  }
  
  // Check for generic webview indicators
  for (const indicator of webviewIndicators) {
    if (userAgent.includes(indicator)) {
      return true;
    }
  }
  
  return false;
};

/**
 * Creates an X (formerly Twitter) share URL with the given text and optional URL
 * @param {string} text - The text to share
 * @param {string} [url] - Optional URL to include in the post
 * @returns {string} The X/Twitter intent URL
 */
export const createTwitterShareUrl = (text, url = null) => {
  const baseUrl = 'https://twitter.com/intent/tweet';
  const params = new URLSearchParams();
  
  if (text) {
    params.append('text', text);
  }
  
  if (url) {
    params.append('url', url);
  }
  
  return `${baseUrl}?${params.toString()}`;
};

/**
 * Opens an external link, using the appropriate method based on the environment
 * 
 * For iOS webviews (like MetaMask), uses window.location.assign() to break out
 * of the webview and open in the default browser (Safari).
 * 
 * For other environments, uses the standard window.open() method.
 * 
 * @param {string} url - The URL to open
 */
export const openExternalLink = (url) => {
  if (typeof window === 'undefined') {
    console.warn('openExternalLink: window is not available');
    return;
  }
  
  const isIOS = isIOSDevice();
  const inWebview = isInWebview();
  
  console.log('🔗 Opening external link:', {
    url,
    isIOS,
    inWebview,
    userAgent: navigator?.userAgent
  });
  
  // For iOS webviews, use location.assign to break out of the webview
  if (isIOS && inWebview) {
    console.log('📱 Using location.assign for iOS webview');
    try {
      window.location.assign(url);
    } catch (error) {
      console.error('Failed to open link with location.assign:', error);
      // Fallback to window.open
      window.open?.(url, '_blank');
    }
  } else {
    // For all other cases, use the standard window.open
    console.log('🌐 Using window.open for standard browser');
    window.open?.(url, '_blank');
  }
};

/**
 * Opens an X (formerly Twitter) share dialog with the given text and URL
 * Uses the appropriate method for the current environment
 *
 * @param {string} text - The text to share
 * @param {string} [url] - Optional URL to include in the post
 */
export const shareOnTwitter = (text, url = null) => {
  const twitterUrl = createTwitterShareUrl(text, url);
  openExternalLink(twitterUrl);
};