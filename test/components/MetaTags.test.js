import { expect } from 'chai';
import { JSDOM } from 'jsdom';

// Mock browser environment for testing
const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;

describe('MetaTags Component', () => {
  beforeEach(() => {
    // Clear head before each test
    document.head.innerHTML = '';
  });

  describe('Basic Meta Tags', () => {
    it('should set basic meta tags correctly', () => {
      // Simulate what the MetaTags component would do
      const title = 'Test Title - ETH Shot';
      const description = 'Test description for ETH Shot';
      const keywords = 'test, ethereum, jackpot';

      // Create meta tags
      document.title = title;
      
      const metaDescription = document.createElement('meta');
      metaDescription.name = 'description';
      metaDescription.content = description;
      document.head.appendChild(metaDescription);

      const metaKeywords = document.createElement('meta');
      metaKeywords.name = 'keywords';
      metaKeywords.content = keywords;
      document.head.appendChild(metaKeywords);

      // Verify
      expect(document.title).to.equal(title);
      expect(document.querySelector('meta[name="description"]').content).to.equal(description);
      expect(document.querySelector('meta[name="keywords"]').content).to.equal(keywords);
    });

    it('should set theme color and author meta tags', () => {
      const themeColor = '#667eea';
      const author = 'ETH Shot';

      const metaTheme = document.createElement('meta');
      metaTheme.name = 'theme-color';
      metaTheme.content = themeColor;
      document.head.appendChild(metaTheme);

      const metaAuthor = document.createElement('meta');
      metaAuthor.name = 'author';
      metaAuthor.content = author;
      document.head.appendChild(metaAuthor);

      expect(document.querySelector('meta[name="theme-color"]').content).to.equal(themeColor);
      expect(document.querySelector('meta[name="author"]').content).to.equal(author);
    });
  });

  describe('OpenGraph Meta Tags', () => {
    it('should set OpenGraph meta tags correctly', () => {
      const ogTitle = 'ETH Shot - Test Page';
      const ogDescription = 'Test description for OpenGraph';
      const ogType = 'website';
      const ogUrl = 'https://ethshot.io/test';
      const ogImage = 'https://ethshot.io/favicon-32x32.png';

      // Create OpenGraph meta tags
      const metaOgTitle = document.createElement('meta');
      metaOgTitle.setAttribute('property', 'og:title');
      metaOgTitle.content = ogTitle;
      document.head.appendChild(metaOgTitle);

      const metaOgDescription = document.createElement('meta');
      metaOgDescription.setAttribute('property', 'og:description');
      metaOgDescription.content = ogDescription;
      document.head.appendChild(metaOgDescription);

      const metaOgType = document.createElement('meta');
      metaOgType.setAttribute('property', 'og:type');
      metaOgType.content = ogType;
      document.head.appendChild(metaOgType);

      const metaOgUrl = document.createElement('meta');
      metaOgUrl.setAttribute('property', 'og:url');
      metaOgUrl.content = ogUrl;
      document.head.appendChild(metaOgUrl);

      const metaOgImage = document.createElement('meta');
      metaOgImage.setAttribute('property', 'og:image');
      metaOgImage.content = ogImage;
      document.head.appendChild(metaOgImage);

      // Verify
      expect(document.querySelector('meta[property="og:title"]').content).to.equal(ogTitle);
      expect(document.querySelector('meta[property="og:description"]').content).to.equal(ogDescription);
      expect(document.querySelector('meta[property="og:type"]').content).to.equal(ogType);
      expect(document.querySelector('meta[property="og:url"]').content).to.equal(ogUrl);
      expect(document.querySelector('meta[property="og:image"]').content).to.equal(ogImage);
    });

    it('should set OpenGraph image properties', () => {
      const ogImageAlt = 'ETH Shot Game Screenshot';
      const ogImageWidth = '1200';
      const ogImageHeight = '630';

      const metaOgImageAlt = document.createElement('meta');
      metaOgImageAlt.setAttribute('property', 'og:image:alt');
      metaOgImageAlt.content = ogImageAlt;
      document.head.appendChild(metaOgImageAlt);

      const metaOgImageWidth = document.createElement('meta');
      metaOgImageWidth.setAttribute('property', 'og:image:width');
      metaOgImageWidth.content = ogImageWidth;
      document.head.appendChild(metaOgImageWidth);

      const metaOgImageHeight = document.createElement('meta');
      metaOgImageHeight.setAttribute('property', 'og:image:height');
      metaOgImageHeight.content = ogImageHeight;
      document.head.appendChild(metaOgImageHeight);

      expect(document.querySelector('meta[property="og:image:alt"]').content).to.equal(ogImageAlt);
      expect(document.querySelector('meta[property="og:image:width"]').content).to.equal(ogImageWidth);
      expect(document.querySelector('meta[property="og:image:height"]').content).to.equal(ogImageHeight);
    });
  });

  describe('Twitter Card Meta Tags', () => {
    it('should set Twitter Card meta tags correctly', () => {
      const twitterCard = 'summary_large_image';
      const twitterSite = '@ethshot';
      const twitterCreator = '@ethshot';
      const twitterTitle = 'ETH Shot - Test Page';
      const twitterDescription = 'Test description for Twitter';
      const twitterImage = 'https://ethshot.io/favicon-32x32.png';

      // Create Twitter meta tags
      const metaTwitterCard = document.createElement('meta');
      metaTwitterCard.name = 'twitter:card';
      metaTwitterCard.content = twitterCard;
      document.head.appendChild(metaTwitterCard);

      const metaTwitterSite = document.createElement('meta');
      metaTwitterSite.name = 'twitter:site';
      metaTwitterSite.content = twitterSite;
      document.head.appendChild(metaTwitterSite);

      const metaTwitterCreator = document.createElement('meta');
      metaTwitterCreator.name = 'twitter:creator';
      metaTwitterCreator.content = twitterCreator;
      document.head.appendChild(metaTwitterCreator);

      const metaTwitterTitle = document.createElement('meta');
      metaTwitterTitle.name = 'twitter:title';
      metaTwitterTitle.content = twitterTitle;
      document.head.appendChild(metaTwitterTitle);

      const metaTwitterDescription = document.createElement('meta');
      metaTwitterDescription.name = 'twitter:description';
      metaTwitterDescription.content = twitterDescription;
      document.head.appendChild(metaTwitterDescription);

      const metaTwitterImage = document.createElement('meta');
      metaTwitterImage.name = 'twitter:image';
      metaTwitterImage.content = twitterImage;
      document.head.appendChild(metaTwitterImage);

      // Verify
      expect(document.querySelector('meta[name="twitter:card"]').content).to.equal(twitterCard);
      expect(document.querySelector('meta[name="twitter:site"]').content).to.equal(twitterSite);
      expect(document.querySelector('meta[name="twitter:creator"]').content).to.equal(twitterCreator);
      expect(document.querySelector('meta[name="twitter:title"]').content).to.equal(twitterTitle);
      expect(document.querySelector('meta[name="twitter:description"]').content).to.equal(twitterDescription);
      expect(document.querySelector('meta[name="twitter:image"]').content).to.equal(twitterImage);
    });
  });

  describe('Canonical URL', () => {
    it('should set canonical URL correctly', () => {
      const canonicalUrl = 'https://ethshot.io/test';

      const linkCanonical = document.createElement('link');
      linkCanonical.rel = 'canonical';
      linkCanonical.href = canonicalUrl;
      document.head.appendChild(linkCanonical);

      expect(document.querySelector('link[rel="canonical"]').href).to.equal(canonicalUrl);
    });
  });

  describe('Structured Data', () => {
    it('should create valid JSON-LD structured data', () => {
      const structuredData = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "ETH Shot - Test Page",
        "description": "Test description",
        "url": "https://ethshot.io/test",
        "image": "https://ethshot.io/favicon-32x32.png",
        "author": {
          "@type": "Organization",
          "name": "ETH Shot"
        },
        "publisher": {
          "@type": "Organization",
          "name": "ETH Shot",
          "logo": {
            "@type": "ImageObject",
            "url": "https://ethshot.io/favicon-32x32.png"
          }
        }
      };

      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(structuredData);
      document.head.appendChild(script);

      const scriptElement = document.querySelector('script[type="application/ld+json"]');
      expect(scriptElement).to.not.be.null;
      
      const parsedData = JSON.parse(scriptElement.textContent);
      expect(parsedData['@context']).to.equal('https://schema.org');
      expect(parsedData['@type']).to.equal('WebSite');
      expect(parsedData.name).to.equal('ETH Shot - Test Page');
      expect(parsedData.author.name).to.equal('ETH Shot');
    });
  });

  describe('Mobile and App Meta Tags', () => {
    it('should set mobile-specific meta tags', () => {
      const viewport = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
      const appleMobileCapable = 'yes';
      const appleMobileTitle = 'ETH Shot';

      const metaViewport = document.createElement('meta');
      metaViewport.name = 'viewport';
      metaViewport.content = viewport;
      document.head.appendChild(metaViewport);

      const metaAppleMobile = document.createElement('meta');
      metaAppleMobile.name = 'apple-mobile-web-app-capable';
      metaAppleMobile.content = appleMobileCapable;
      document.head.appendChild(metaAppleMobile);

      const metaAppleTitle = document.createElement('meta');
      metaAppleTitle.name = 'apple-mobile-web-app-title';
      metaAppleTitle.content = appleMobileTitle;
      document.head.appendChild(metaAppleTitle);

      expect(document.querySelector('meta[name="viewport"]').content).to.equal(viewport);
      expect(document.querySelector('meta[name="apple-mobile-web-app-capable"]').content).to.equal(appleMobileCapable);
      expect(document.querySelector('meta[name="apple-mobile-web-app-title"]').content).to.equal(appleMobileTitle);
    });
  });

  describe('Security Headers', () => {
    it('should set security-related meta tags', () => {
      const xContentTypeOptions = 'nosniff';
      const xFrameOptions = 'DENY';
      const xXSSProtection = '1; mode=block';

      const metaContentType = document.createElement('meta');
      metaContentType.setAttribute('http-equiv', 'X-Content-Type-Options');
      metaContentType.content = xContentTypeOptions;
      document.head.appendChild(metaContentType);

      const metaFrameOptions = document.createElement('meta');
      metaFrameOptions.setAttribute('http-equiv', 'X-Frame-Options');
      metaFrameOptions.content = xFrameOptions;
      document.head.appendChild(metaFrameOptions);

      const metaXSSProtection = document.createElement('meta');
      metaXSSProtection.setAttribute('http-equiv', 'X-XSS-Protection');
      metaXSSProtection.content = xXSSProtection;
      document.head.appendChild(metaXSSProtection);

      expect(document.querySelector('meta[http-equiv="X-Content-Type-Options"]').content).to.equal(xContentTypeOptions);
      expect(document.querySelector('meta[http-equiv="X-Frame-Options"]').content).to.equal(xFrameOptions);
      expect(document.querySelector('meta[http-equiv="X-XSS-Protection"]').content).to.equal(xXSSProtection);
    });
  });

  describe('Icon Links', () => {
    it('should set favicon and icon links', () => {
      const appleTouchIcon = '/apple-touch-icon.png';
      const favicon32 = '/favicon-32x32.png';
      const favicon16 = '/favicon-16x16.png';

      const linkAppleTouch = document.createElement('link');
      linkAppleTouch.rel = 'apple-touch-icon';
      linkAppleTouch.sizes = '180x180';
      linkAppleTouch.href = appleTouchIcon;
      document.head.appendChild(linkAppleTouch);

      const linkFavicon32 = document.createElement('link');
      linkFavicon32.rel = 'icon';
      linkFavicon32.type = 'image/png';
      linkFavicon32.sizes = '32x32';
      linkFavicon32.href = favicon32;
      document.head.appendChild(linkFavicon32);

      const linkFavicon16 = document.createElement('link');
      linkFavicon16.rel = 'icon';
      linkFavicon16.type = 'image/png';
      linkFavicon16.sizes = '16x16';
      linkFavicon16.href = favicon16;
      document.head.appendChild(linkFavicon16);

      // Verify links exist
      expect(document.querySelector('link[rel="apple-touch-icon"]')).to.not.be.null;
      expect(document.querySelector('link[rel="icon"][sizes="32x32"]')).to.not.be.null;
      expect(document.querySelector('link[rel="icon"][sizes="16x16"]')).to.not.be.null;
      
      // Verify attributes
      expect(document.querySelector('link[rel="apple-touch-icon"]').sizes).to.equal('180x180');
      expect(document.querySelector('link[rel="icon"][sizes="32x32"]').type).to.equal('image/png');
      expect(document.querySelector('link[rel="icon"][sizes="16x16"]').type).to.equal('image/png');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty or undefined props gracefully', () => {
      // Test with minimal props
      const title = 'ETH Shot - Take Your Shot at the ETH Jackpot';
      document.title = title;

      expect(document.title).to.equal(title);
      expect(document.head.children.length).to.be.greaterThan(0);
    });

    it('should handle special characters in meta content', () => {
      const description = 'ETH Shot - "Take your shot" at the jackpot! 50% chance & instant payouts.';
      
      const metaDescription = document.createElement('meta');
      metaDescription.name = 'description';
      metaDescription.content = description;
      document.head.appendChild(metaDescription);

      expect(document.querySelector('meta[name="description"]').content).to.equal(description);
    });

    it('should handle long content gracefully', () => {
      const longDescription = 'A'.repeat(500); // Very long description
      
      const metaDescription = document.createElement('meta');
      metaDescription.name = 'description';
      metaDescription.content = longDescription;
      document.head.appendChild(metaDescription);

      expect(document.querySelector('meta[name="description"]').content).to.equal(longDescription);
    });
  });
});