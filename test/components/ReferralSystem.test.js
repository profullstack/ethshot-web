import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import { render, fireEvent, waitFor, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import ReferralSystem from '../../src/lib/components/ReferralSystem.svelte';
import { walletStore } from '../../src/lib/stores/wallet.js';
import { gameStore } from '../../src/lib/stores/game-unified.js';
import { toastStore } from '../../src/lib/stores/toast.js';
import { db } from '../../src/lib/supabase.js';

// Mock stores
const mockWalletStore = {
  subscribe: (callback) => {
    callback({ connected: false, address: null });
    return () => {};
  }
};

const mockGameStore = {
  subscribe: (callback) => {
    callback({ currentPot: { amount: '0.1', currency: 'ETH', usdValue: 250 } });
    return () => {};
  }
};

const mockToastStore = {
  success: () => {},
  error: () => {}
};

// Mock database operations
const mockDb = {
  getReferralStats: async () => ({
    referral_code: 'TEST1234',
    total_referrals: 5,
    successful_referrals: 3,
    bonus_shots_available: 2,
    total_bonus_shots_earned: 8,
    referred_by: null
  }),
  createReferralCode: async () => 'TEST1234'
};

// Mock browser APIs
const mockClipboard = {
  writeText: async () => true
};

const mockNavigator = {
  clipboard: mockClipboard,
  share: async () => true
};

describe('ReferralSystem Component', () => {
  let component;
  let originalNavigator;
  let originalWindow;

  beforeEach(() => {
    // Mock browser environment
    originalNavigator = global.navigator;
    originalWindow = global.window;
    
    global.navigator = mockNavigator;
    global.window = {
      location: { origin: 'https://ethshot.io', search: '' },
      localStorage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {}
      },
      open: () => {}
    };

    // Mock modules
    global.walletStore = mockWalletStore;
    global.gameStore = mockGameStore;
    global.toastStore = mockToastStore;
    global.db = mockDb;
  });

  afterEach(() => {
    if (component) {
      component.$destroy();
    }
    global.navigator = originalNavigator;
    global.window = originalWindow;
  });

  describe('Component Rendering', () => {
    it('should render connect prompt when wallet not connected', () => {
      component = render(ReferralSystem);
      
      expect(screen.getByText('Connect your wallet to access your referral system')).to.exist;
      expect(screen.getByText('👛')).to.exist;
    });

    it('should render loading state initially when wallet connected', async () => {
      const connectedWalletStore = {
        subscribe: (callback) => {
          callback({ connected: true, address: '0x123...abc' });
          return () => {};
        }
      };
      
      global.walletStore = connectedWalletStore;
      component = render(ReferralSystem);
      
      expect(screen.getByText('Loading your referral data...')).to.exist;
      expect(screen.getByRole('status')).to.exist; // spinner
    });

    it('should render referral stats when loaded', async () => {
      const connectedWalletStore = {
        subscribe: (callback) => {
          callback({ connected: true, address: '0x123...abc' });
          return () => {};
        }
      };
      
      global.walletStore = connectedWalletStore;
      component = render(ReferralSystem);
      
      // Wait for async loading to complete
      await waitFor(() => {
        expect(screen.getByText('2')).to.exist; // bonus shots available
        expect(screen.getByText('5')).to.exist; // total referrals
        expect(screen.getByText('3')).to.exist; // successful referrals
        expect(screen.getByText('8')).to.exist; // total bonus shots earned
      });
    });

    it('should display referral code when available', async () => {
      const connectedWalletStore = {
        subscribe: (callback) => {
          callback({ connected: true, address: '0x123...abc' });
          return () => {};
        }
      };
      
      global.walletStore = connectedWalletStore;
      component = render(ReferralSystem);
      
      await waitFor(() => {
        expect(screen.getByText('TEST1234')).to.exist;
        expect(screen.getByText('Your Referral Code')).to.exist;
      });
    });

    it('should show success rate when referrals exist', async () => {
      const connectedWalletStore = {
        subscribe: (callback) => {
          callback({ connected: true, address: '0x123...abc' });
          return () => {};
        }
      };
      
      global.walletStore = connectedWalletStore;
      component = render(ReferralSystem);
      
      await waitFor(() => {
        expect(screen.getByText('Success Rate')).to.exist;
        expect(screen.getByText('60% of your referrals became active players')).to.exist;
      });
    });
  });

  describe('Share Functionality', () => {
    beforeEach(async () => {
      const connectedWalletStore = {
        subscribe: (callback) => {
          callback({ connected: true, address: '0x123...abc' });
          return () => {};
        }
      };
      
      global.walletStore = connectedWalletStore;
      component = render(ReferralSystem);
      
      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText('TEST1234')).to.exist;
      });
    });

    it('should copy referral link to clipboard', async () => {
      let copiedText = '';
      global.navigator.clipboard.writeText = async (text) => {
        copiedText = text;
        return true;
      };

      const copyButton = screen.getByText('Copy Link').closest('button');
      await fireEvent.click(copyButton);
      
      expect(copiedText).to.include('TEST1234');
      expect(copiedText).to.include('ethshot.io');
    });

    it('should open Twitter share when tweet button clicked', async () => {
      let openedUrl = '';
      global.window.open = (url) => {
        openedUrl = url;
      };

      const tweetButton = screen.getByText('Tweet').closest('button');
      await fireEvent.click(tweetButton);
      
      expect(openedUrl).to.include('twitter.com/intent/tweet');
      expect(openedUrl).to.include('TEST1234');
    });

    it('should use native share API when available', async () => {
      let sharedData = null;
      global.navigator.share = async (data) => {
        sharedData = data;
        return true;
      };

      const shareButton = screen.getByText('Share Link').closest('button');
      await fireEvent.click(shareButton);
      
      expect(sharedData).to.not.be.null;
      expect(sharedData.url).to.include('TEST1234');
      expect(sharedData.title).to.include('EthShot');
    });

    it('should toggle share options when more button clicked', async () => {
      const moreButton = screen.getByText('More').closest('button');
      await fireEvent.click(moreButton);
      
      expect(screen.getByText('💡 Sharing Tips')).to.exist;
      expect(screen.getByDisplayValue(/ethshot\.io.*TEST1234/)).to.exist;
    });
  });

  describe('Achievement System', () => {
    it('should show achievement notification for milestones', async () => {
      const highStatsDb = {
        getReferralStats: async () => ({
          referral_code: 'TEST1234',
          total_referrals: 10, // Achievement milestone
          successful_referrals: 8,
          bonus_shots_available: 5,
          total_bonus_shots_earned: 15,
          referred_by: null
        }),
        createReferralCode: async () => 'TEST1234'
      };
      
      global.db = highStatsDb;
      
      const connectedWalletStore = {
        subscribe: (callback) => {
          callback({ connected: true, address: '0x123...abc' });
          return () => {};
        }
      };
      
      global.walletStore = connectedWalletStore;
      component = render(ReferralSystem);
      
      await waitFor(() => {
        expect(screen.getByText(/Referral Champion/)).to.exist;
        expect(screen.getByText('🎉')).to.exist;
      });
    });
  });

  describe('Referral Benefits Display', () => {
    it('should show referral benefits section', async () => {
      const connectedWalletStore = {
        subscribe: (callback) => {
          callback({ connected: true, address: '0x123...abc' });
          return () => {};
        }
      };
      
      global.walletStore = connectedWalletStore;
      component = render(ReferralSystem);
      
      await waitFor(() => {
        expect(screen.getByText('🎁 Referral Rewards')).to.exist;
        expect(screen.getByText('Free Bonus Shot')).to.exist;
        expect(screen.getByText('Referral Reward')).to.exist;
        expect(screen.getByText('Leaderboard Fame')).to.exist;
      });
    });
  });

  describe('Referred By Display', () => {
    it('should show referrer information when user was referred', async () => {
      const referredDb = {
        getReferralStats: async () => ({
          referral_code: 'TEST1234',
          total_referrals: 2,
          successful_referrals: 1,
          bonus_shots_available: 1,
          total_bonus_shots_earned: 3,
          referred_by: '0x456...def'
        }),
        createReferralCode: async () => 'TEST1234'
      };
      
      global.db = referredDb;
      
      const connectedWalletStore = {
        subscribe: (callback) => {
          callback({ connected: true, address: '0x123...abc' });
          return () => {};
        }
      };
      
      global.walletStore = connectedWalletStore;
      component = render(ReferralSystem);
      
      await waitFor(() => {
        expect(screen.getByText(/You were referred by/)).to.exist;
        expect(screen.getByText('0x456...def')).to.exist;
        expect(screen.getByText('🤝')).to.exist;
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const errorDb = {
        getReferralStats: async () => {
          throw new Error('Database connection failed');
        },
        createReferralCode: async () => {
          throw new Error('Failed to create code');
        }
      };
      
      let errorMessage = '';
      const errorToastStore = {
        success: () => {},
        error: (msg) => { errorMessage = msg; }
      };
      
      global.db = errorDb;
      global.toastStore = errorToastStore;
      
      const connectedWalletStore = {
        subscribe: (callback) => {
          callback({ connected: true, address: '0x123...abc' });
          return () => {};
        }
      };
      
      global.walletStore = connectedWalletStore;
      component = render(ReferralSystem);
      
      await waitFor(() => {
        expect(errorMessage).to.equal('Failed to load referral data');
      });
    });

    it('should handle clipboard API failures', async () => {
      global.navigator.clipboard.writeText = async () => {
        throw new Error('Clipboard access denied');
      };
      
      let errorMessage = '';
      const errorToastStore = {
        success: () => {},
        error: (msg) => { errorMessage = msg; }
      };
      
      global.toastStore = errorToastStore;
      
      const connectedWalletStore = {
        subscribe: (callback) => {
          callback({ connected: true, address: '0x123...abc' });
          return () => {};
        }
      };
      
      global.walletStore = connectedWalletStore;
      component = render(ReferralSystem);
      
      await waitFor(() => {
        expect(screen.getByText('TEST1234')).to.exist;
      });
      
      const copyButton = screen.getByText('Copy Link').closest('button');
      await fireEvent.click(copyButton);
      
      expect(errorMessage).to.equal('Failed to copy link');
    });
  });

  describe('Responsive Design', () => {
    it('should render mobile-friendly layout', async () => {
      // Mock mobile viewport
      Object.defineProperty(global.window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      });
      
      const connectedWalletStore = {
        subscribe: (callback) => {
          callback({ connected: true, address: '0x123...abc' });
          return () => {};
        }
      };
      
      global.walletStore = connectedWalletStore;
      component = render(ReferralSystem);
      
      await waitFor(() => {
        const statsGrid = component.container.querySelector('.stats-grid');
        expect(statsGrid).to.exist;
        
        const shareButtons = component.container.querySelector('.share-buttons');
        expect(shareButtons).to.exist;
      });
    });
  });
});