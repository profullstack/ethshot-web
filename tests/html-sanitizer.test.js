/**
 * HTML Sanitizer Tests
 * 
 * Tests for HTML sanitization utilities to prevent XSS attacks
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import { sanitizeNickname } from '../src/lib/utils/html-sanitizer.js';

describe('HTML Sanitizer', () => {
  describe('sanitizeNickname', () => {
    it('should return empty string for null or undefined input', () => {
      expect(sanitizeNickname(null)).to.equal('');
      expect(sanitizeNickname(undefined)).to.equal('');
      expect(sanitizeNickname('')).to.equal('');
    });

    it('should return clean nickname for safe input', () => {
      expect(sanitizeNickname('Alice')).to.equal('Alice');
      expect(sanitizeNickname('Bob123')).to.equal('Bob123');
      expect(sanitizeNickname('user_name')).to.equal('user_name');
    });

    it('should remove HTML tags from nickname', () => {
      expect(sanitizeNickname('<script>alert("xss")</script>Alice')).to.equal('alert("xss")Alice');
      expect(sanitizeNickname('Bob<img src="x" onerror="alert(1)">')).to.equal('Bob');
      expect(sanitizeNickname('<b>Bold</b>Name')).to.equal('BoldName');
    });

    it('should escape HTML entities in nickname', () => {
      expect(sanitizeNickname('Alice & Bob')).to.equal('Alice &amp; Bob');
      expect(sanitizeNickname('User<test>')).to.equal('User&lt;test&gt;');
      expect(sanitizeNickname('Quote"Test')).to.equal('Quote&quot;Test');
    });

    it('should handle complex XSS attempts', () => {
      const maliciousInput = '<script>document.cookie="stolen"</script><img src="x" onerror="alert(\'XSS\')">';
      const sanitized = sanitizeNickname(maliciousInput);
      
      // Should not contain any HTML tags
      expect(sanitized).to.not.include('<');
      expect(sanitized).to.not.include('>');
      expect(sanitized).to.not.include('script');
      expect(sanitized).to.not.include('img');
    });

    it('should trim whitespace', () => {
      expect(sanitizeNickname('  Alice  ')).to.equal('Alice');
      expect(sanitizeNickname('\n\tBob\n\t')).to.equal('Bob');
    });
  });
});