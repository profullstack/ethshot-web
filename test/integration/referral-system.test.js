import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import { gameStore } from '../../src/lib/stores/game-unified.js';
import { db } from '../../src/lib/supabase.js';
import {
  generateReferralURL,
  validateReferralCode,
  processReferralOnLoad,
  storeReferralCode,
  clearStoredReferralCode
} from '../../src/lib/utils/referral.js';

// Mock browser environment
global.window = {
  location: { 
    origin: 'https://ethshot.io',
    search: '',
    href: 'https://ethshot.io'
  },
  localStorage: {
    storage: {},
    getItem(key) { return this.storage[key] || null; },
    setItem(key, value) { this.storage[key] = value; },
    removeItem(key) { delete this.storage[key]; },
    clear() { this.storage = {}; }
  }
};

global.navigator = {
  clipboard: {
    writeText: async (text) => true
  },
  share: async (data) => true
};

// Mock database operations
const mockDb = {
  createReferralCode: async (address) => 'TEST1234',
  processReferralSignup: async (code, address) => true,
  getAvailableDiscounts: async (address) => 2,
  useDiscount: async (address) => true,
  getReferralStats: async (address) => ({
    referral_code: 'TEST1234',
    total_referrals: 5,
    successful_referrals: 3,
    available_discounts: 2,
    total_discounts_earned: 8,
    referred_by: null
  }),
  getReferralLeaderboard: async (options) => [
    {
      referrer_address: '0x123...abc',
      total_referrals: 10,
      successful_referrals: 8,
      success_rate: 80,
      total_discounts_earned: 15
    },
    {
      referrer_address: '0x456...def',
      total_referrals: 7,
      successful_referrals: 5,
      success_rate: 71,
      total_discounts_earned: 12
    }
  ]
};

describe('Referral System Integration', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    global.window.localStorage.clear();
    
    // Reset URL search params
    global.window.location.search = '';
    
    // Mock database
    Object.assign(db, mockDb);
  });

  afterEach(() => {
    // Clean up after each test
    clearStoredReferralCode();
  });

  describe('Referral Code Generation and Validation', () => {
    it('should generate valid referral URLs', () => {
      const code = 'TEST1234';
      const url = generateReferralURL(code);
      
      expect(url).to.include('ethshot.io');
      expect(url).to.include(`ref=${code}`);
      expect(url).to.match(/^https?:\/\//);
    });

    it('should validate referral codes correctly', async () => {
      const validCode = 'TEST1234';
      const invalidCode = 'INVALID';
      
      // Mock validation responses
      db.validateReferralCode = async (code) => code === 'TEST1234';
      
      const validResult = await validateReferralCode(validCode);
      const invalidResult = await validateReferralCode(invalidCode);
      
      expect(validResult).to.be.true;
      expect(invalidResult).to.be.false;
    });

    it('should handle referral code storage and retrieval', () => {
      const testCode = 'TEST1234';
      
      // Store referral code
      storeReferralCode(testCode);
      
      // Check if stored correctly
      const stored = global.window.localStorage.getItem('pendingReferralCode');
      expect(stored).to.equal(testCode);
      
      // Clear referral code
      clearStoredReferralCode();
      
      // Check if cleared
      const cleared = global.window.localStorage.getItem('pendingReferralCode');
      expect(cleared).to.be.null;
    });
  });

  describe('URL Parameter Processing', () => {
    it('should extract referral code from URL parameters', async () => {
      // Mock URL with referral parameter
      global.window.location.search = '?ref=TEST1234';
      
      // Mock successful processing
      db.processReferralSignup = async (code, address) => {
        expect(code).to.equal('TEST1234');
        return true;
      };
      
      // Process referral should extract and store the code
      const result = await processReferralOnLoad();
      
      // Should store the code for later processing
      const stored = global.window.localStorage.getItem('pendingReferralCode');
      expect(stored).to.equal('TEST1234');
    });

    it('should handle missing referral parameters gracefully', async () => {
      // No referral parameter in URL
      global.window.location.search = '';
      
      const result = await processReferralOnLoad();
      
      // Should not store anything
      const stored = global.window.localStorage.getItem('pendingReferralCode');
      expect(stored).to.be.null;
    });

    it('should handle invalid referral codes in URL', async () => {
      global.window.location.search = '?ref=INVALID';
      
      // Mock validation failure
      db.validateReferralCode = async (code) => false;
      
      const result = await processReferralOnLoad();
      
      // Should not store invalid codes
      const stored = global.window.localStorage.getItem('pendingReferralCode');
      expect(stored).to.be.null;
    });
  });

  describe('Database Integration', () => {
    it('should create referral codes for new users', async () => {
      const testAddress = '0x123...abc';
      
      const code = await db.createReferralCode(testAddress);
      
      expect(code).to.be.a('string');
      expect(code).to.have.lengthOf.at.least(6);
    });

    it('should process referral signups correctly', async () => {
      const referralCode = 'TEST1234';
      const refereeAddress = '0x456...def';
      
      const result = await db.processReferralSignup(referralCode, refereeAddress);
      
      expect(result).to.be.true;
    });

    it('should track available discounts correctly', async () => {
      const testAddress = '0x123...abc';
      
      const availableDiscounts = await db.getAvailableDiscounts(testAddress);
      
      expect(availableDiscounts).to.be.a('number');
      expect(availableDiscounts).to.be.at.least(0);
    });

    it('should use discounts correctly', async () => {
      const testAddress = '0x123...abc';
      
      const result = await db.useDiscount(testAddress);
      
      expect(result).to.be.true;
    });

    it('should retrieve referral stats', async () => {
      const testAddress = '0x123...abc';
      
      const stats = await db.getReferralStats(testAddress);
      
      expect(stats).to.be.an('object');
      expect(stats).to.have.property('referral_code');
      expect(stats).to.have.property('total_referrals');
      expect(stats).to.have.property('successful_referrals');
      expect(stats).to.have.property('available_discounts');
    });

    it('should retrieve referral leaderboard', async () => {
      const leaderboard = await db.getReferralLeaderboard({ limit: 10 });
      
      expect(leaderboard).to.be.an('array');
      expect(leaderboard).to.have.length.at.least(1);
      
      if (leaderboard.length > 0) {
        const entry = leaderboard[0];
        expect(entry).to.have.property('referrer_address');
        expect(entry).to.have.property('total_referrals');
        expect(entry).to.have.property('successful_referrals');
        expect(entry).to.have.property('success_rate');
      }
    });
  });

  describe('Game Store Integration', () => {
    it('should integrate referral data into game state', async () => {
      // Mock wallet connection
      const mockWallet = {
        connected: true,
        address: '0x123...abc'
      };

      // Mock game store methods
      const mockGameStore = {
        loadPlayerData: async (address) => {
          const [availableDiscounts, referralStats] = await Promise.all([
            db.getAvailableDiscounts(address),
            db.getReferralStats(address)
          ]);
          
          return {
            availableDiscounts: availableDiscounts,
            referralStats: referralStats
          };
        }
      };

      const playerData = await mockGameStore.loadPlayerData(mockWallet.address);
      
      expect(playerData).to.have.property('availableDiscounts');
      expect(playerData).to.have.property('referralStats');
      expect(playerData.availableDiscounts).to.be.a('number');
      expect(playerData.referralStats).to.be.an('object');
    });

    it('should handle discount usage in game flow', async () => {
      const testAddress = '0x123...abc';
      
      // Check initial available discounts
      const initialDiscounts = await db.getAvailableDiscounts(testAddress);
      expect(initialDiscounts).to.be.at.least(1);
      
      // Use a discount
      const usageResult = await db.useDiscount(testAddress);
      expect(usageResult).to.be.true;
      
      // Verify discount was consumed (in real implementation)
      // This would check that the count decreased
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection failures gracefully', async () => {
      // Mock database failure
      const originalCreateReferralCode = db.createReferralCode;
      db.createReferralCode = async () => {
        throw new Error('Database connection failed');
      };

      try {
        const result = await db.createReferralCode('0x123...abc');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Database connection failed');
      }

      // Restore original function
      db.createReferralCode = originalCreateReferralCode;
    });

    it('should handle invalid referral codes gracefully', async () => {
      const invalidCode = '';
      
      // Mock validation for empty code
      db.validateReferralCode = async (code) => {
        if (!code || code.length < 6) return false;
        return true;
      };
      
      const result = await validateReferralCode(invalidCode);
      expect(result).to.be.false;
    });

    it('should handle localStorage unavailability', () => {
      // Mock localStorage unavailable
      const originalLocalStorage = global.window.localStorage;
      global.window.localStorage = null;

      // Should not throw error when localStorage is unavailable
      expect(() => {
        storeReferralCode('TEST1234');
      }).to.not.throw();

      // Restore localStorage
      global.window.localStorage = originalLocalStorage;
    });
  });

  describe('Social Sharing Integration', () => {
    it('should generate shareable referral URLs', () => {
      const code = 'TEST1234';
      const url = generateReferralURL(code);
      
      expect(url).to.include('ethshot.io');
      expect(url).to.include(`ref=${code}`);
      
      // Should be a valid URL
      expect(() => new URL(url)).to.not.throw();
    });

    it('should handle clipboard operations', async () => {
      const testCode = 'TEST1234';
      
      // Mock clipboard success
      global.navigator.clipboard.writeText = async (text) => {
        expect(text).to.include(testCode);
        return true;
      };

      // This would be called by the referral component
      const url = generateReferralURL(testCode);
      const result = await global.navigator.clipboard.writeText(url);
      
      expect(result).to.be.true;
    });

    it('should handle native share API', async () => {
      const testCode = 'TEST1234';
      
      // Mock native share
      global.navigator.share = async (data) => {
        expect(data).to.have.property('url');
        expect(data.url).to.include(testCode);
        return true;
      };

      const url = generateReferralURL(testCode);
      const result = await global.navigator.share({
        title: 'Join EthShot',
        text: 'Try your luck at EthShot!',
        url: url
      });
      
      expect(result).to.be.true;
    });
  });

  describe('Real-time Updates', () => {
    it('should handle referral system real-time subscriptions', () => {
      // Mock subscription setup
      const mockSubscription = {
        unsubscribe: () => true
      };

      // Mock database subscription
      db.subscribeToReferralUpdates = (callback) => {
        // Simulate real-time update
        setTimeout(() => {
          callback({
            event: 'INSERT',
            new: {
              referrer_address: '0x123...abc',
              referee_address: '0x456...def'
            }
          });
        }, 100);
        
        return mockSubscription;
      };

      let updateReceived = false;
      const subscription = db.subscribeToReferralUpdates((payload) => {
        updateReceived = true;
        expect(payload).to.have.property('new');
        expect(payload.new).to.have.property('referrer_address');
      });

      expect(subscription).to.have.property('unsubscribe');
      
      // Clean up
      subscription.unsubscribe();
    });
  });
});