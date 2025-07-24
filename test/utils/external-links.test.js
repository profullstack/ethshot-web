import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { 
  isInWebview, 
  isIOSDevice, 
  openExternalLink,
  createTwitterShareUrl 
} from '../../src/lib/utils/external-links.js';

describe('External Links Utility', () => {
  let originalNavigator;
  let originalWindow;

  beforeEach(() => {
    // Store original values
    originalNavigator = global.navigator;
    originalWindow = global.window;
    
    // Mock browser environment
    global.window = {
      open: () => {},
      location: { 
        href: '',
        assign: () => {}
      }
    };
    
    // Create a new navigator object
    global.navigator = {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15'
    };
  });

  afterEach(() => {
    // Restore original values
    global.navigator = originalNavigator;
    global.window = originalWindow;
  });

  describe('isIOSDevice', () => {
    it('should detect iOS devices from user agent', () => {
      global.navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15';
      expect(isIOSDevice()).to.be.true;

      global.navigator.userAgent = 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15';
      expect(isIOSDevice()).to.be.true;

      global.navigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
      expect(isIOSDevice()).to.be.false;

      global.navigator.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
      expect(isIOSDevice()).to.be.false;
    });

    it('should handle missing navigator gracefully', () => {
      global.navigator = undefined;
      expect(isIOSDevice()).to.be.false;
    });
  });

  describe('isInWebview', () => {
    it('should detect MetaMask webview', () => {
      global.navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MetaMaskMobile';
      expect(isInWebview()).to.be.true;
    });

    it('should detect Trust Wallet webview', () => {
      global.navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Trust';
      expect(isInWebview()).to.be.true;
    });

    it('should detect Coinbase Wallet webview', () => {
      global.navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 CoinbaseWallet';
      expect(isInWebview()).to.be.true;
    });

    it('should detect generic webview indicators', () => {
      global.navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 wv';
      expect(isInWebview()).to.be.true;
    });

    it('should not detect Safari as webview', () => {
      global.navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1';
      expect(isInWebview()).to.be.false;
    });

    it('should handle missing navigator gracefully', () => {
      global.navigator = undefined;
      expect(isInWebview()).to.be.false;
    });
  });

  describe('createTwitterShareUrl', () => {
    it('should create proper Twitter share URL with text and url', () => {
      const text = 'Check out this awesome game!';
      const url = 'https://ethshot.io';
      const result = createTwitterShareUrl(text, url);
      
      expect(result).to.include('https://twitter.com/intent/tweet');
      expect(result).to.include(encodeURIComponent(text));
      expect(result).to.include(encodeURIComponent(url));
    });

    it('should handle special characters in text', () => {
      const text = 'I won 🎉 $100 ETH! #crypto';
      const url = 'https://ethshot.io';
      const result = createTwitterShareUrl(text, url);
      
      expect(result).to.include('https://twitter.com/intent/tweet');
      expect(result).to.include(encodeURIComponent(text));
    });

    it('should work with only text parameter', () => {
      const text = 'Check this out!';
      const result = createTwitterShareUrl(text);
      
      expect(result).to.include('https://twitter.com/intent/tweet');
      expect(result).to.include(encodeURIComponent(text));
      expect(result).to.not.include('url=');
    });
  });

  describe('openExternalLink', () => {
    let windowOpenCalls;
    let locationAssignCalls;

    beforeEach(() => {
      windowOpenCalls = [];
      locationAssignCalls = [];
      
      global.window.open = (...args) => {
        windowOpenCalls.push(args);
        return { closed: false };
      };
      
      global.window.location.assign = (url) => {
        locationAssignCalls.push(url);
      };
    });

    it('should use location.assign for iOS webview', () => {
      global.navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 MetaMaskMobile';
      
      const url = 'https://twitter.com/intent/tweet?text=hello';
      openExternalLink(url);
      
      expect(locationAssignCalls).to.have.length(1);
      expect(locationAssignCalls[0]).to.equal(url);
      expect(windowOpenCalls).to.have.length(0);
    });

    it('should use window.open for non-iOS or non-webview', () => {
      global.navigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
      
      const url = 'https://twitter.com/intent/tweet?text=hello';
      openExternalLink(url);
      
      expect(windowOpenCalls).to.have.length(1);
      expect(windowOpenCalls[0]).to.deep.equal([url, '_blank']);
      expect(locationAssignCalls).to.have.length(0);
    });

    it('should use window.open for iOS Safari (not webview)', () => {
      global.navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1';
      
      const url = 'https://twitter.com/intent/tweet?text=hello';
      openExternalLink(url);
      
      expect(windowOpenCalls).to.have.length(1);
      expect(windowOpenCalls[0]).to.deep.equal([url, '_blank']);
      expect(locationAssignCalls).to.have.length(0);
    });

    it('should handle missing window gracefully', () => {
      global.window = undefined;
      
      expect(() => {
        openExternalLink('https://example.com');
      }).to.not.throw();
    });
  });
});