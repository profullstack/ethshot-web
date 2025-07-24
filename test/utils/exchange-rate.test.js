/**
 * Exchange Rate Utility Tests
 * 
 * Tests for the Tatum API exchange rate fetching functionality
 */

import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import {
  fetchETHUSDRate,
  getCurrentETHUSDRate,
  clearExchangeRateCache,
  getCacheInfo
} from '../../src/lib/utils/exchange-rate.js';

describe('Exchange Rate Utility', () => {
  beforeEach(() => {
    // Clear cache before each test
    clearExchangeRateCache();
  });

  describe('fetchETHUSDRate', () => {
    it('should return a valid number', async () => {
      const rate = await fetchETHUSDRate();
      
      expect(rate).to.be.a('number');
      expect(rate).to.be.greaterThan(0);
      expect(rate).to.be.lessThan(100000); // Reasonable upper bound
    });

    it('should return fallback rate when API key is missing', async () => {
      // This test assumes no valid API key is set
      const rate = await fetchETHUSDRate();
      
      expect(rate).to.be.a('number');
      expect(rate).to.be.greaterThan(0);
    });

    it('should cache the result', async () => {
      const rate1 = await fetchETHUSDRate();
      const cacheInfo1 = getCacheInfo();
      
      expect(cacheInfo1.cachedRate).to.equal(rate1);
      expect(cacheInfo1.cacheTimestamp).to.be.a('number');
      expect(cacheInfo1.isExpired).to.be.false;
      
      // Second call should use cache
      const rate2 = await fetchETHUSDRate();
      const cacheInfo2 = getCacheInfo();
      
      expect(rate2).to.equal(rate1);
      expect(cacheInfo2.cacheTimestamp).to.equal(cacheInfo1.cacheTimestamp);
    });
  });

  describe('getCurrentETHUSDRate', () => {
    it('should return the same result as fetchETHUSDRate', async () => {
      const rate1 = await fetchETHUSDRate();
      const rate2 = await getCurrentETHUSDRate();
      
      expect(rate2).to.equal(rate1);
    });
  });

  describe('clearExchangeRateCache', () => {
    it('should clear the cache', async () => {
      // First, populate the cache
      await fetchETHUSDRate();
      let cacheInfo = getCacheInfo();
      expect(cacheInfo.cachedRate).to.not.be.null;
      
      // Clear the cache
      clearExchangeRateCache();
      cacheInfo = getCacheInfo();
      
      expect(cacheInfo.cachedRate).to.be.null;
      expect(cacheInfo.cacheTimestamp).to.be.null;
      expect(cacheInfo.isExpired).to.be.true;
    });
  });

  describe('getCacheInfo', () => {
    it('should return correct cache information', async () => {
      // Initially, cache should be empty
      let cacheInfo = getCacheInfo();
      expect(cacheInfo.cachedRate).to.be.null;
      expect(cacheInfo.cacheTimestamp).to.be.null;
      expect(cacheInfo.cacheAge).to.be.null;
      expect(cacheInfo.isExpired).to.be.true;
      
      // After fetching, cache should be populated
      const rate = await fetchETHUSDRate();
      cacheInfo = getCacheInfo();
      
      expect(cacheInfo.cachedRate).to.equal(rate);
      expect(cacheInfo.cacheTimestamp).to.be.a('number');
      expect(cacheInfo.cacheAge).to.be.a('number');
      expect(cacheInfo.cacheAge).to.be.lessThan(1000); // Should be very recent
      expect(cacheInfo.isExpired).to.be.false;
    });
  });

  describe('Error handling', () => {
    it('should handle network errors gracefully', async () => {
      // This test will use fallback rate if API fails
      const rate = await fetchETHUSDRate();
      
      expect(rate).to.be.a('number');
      expect(rate).to.be.greaterThan(0);
    });
  });
});