import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import Leaderboard from '../src/lib/components/Leaderboard.svelte';
import ReferralLeaderboard from '../src/lib/components/ReferralLeaderboard.svelte';
import UserDisplay from '../src/lib/components/UserDisplay.svelte';

// Mock the supabase module
vi.mock('../src/lib/supabase.js', () => ({
  db: {
    getTopPlayers: vi.fn(),
    getUserProfiles: vi.fn(),
    getReferralLeaderboard: vi.fn(),
    subscribeToReferralUpdates: vi.fn(() => ({ unsubscribe: vi.fn() }))
  },
  formatAddress: vi.fn((address) => `${address.slice(0, 6)}...${address.slice(-4)}`)
}));

// Mock wallet store
vi.mock('../src/lib/stores/wallet.js', () => ({
  walletStore: {
    subscribe: vi.fn((callback) => {
      callback({ connected: false, address: null });
      return () => {};
    })
  }
}));

// Mock toast store
vi.mock('../src/lib/stores/toast.js', () => ({
  toastStore: {
    error: vi.fn()
  }
}));

// Mock game store
vi.mock('../src/lib/stores/game/index.js', () => ({
  gameStore: {
    subscribe: vi.fn((callback) => {
      callback({});
      return () => {};
    })
  }
}));

describe('UserDisplay Component', () => {
  it('should display nickname when profile exists', () => {
    const profile = {
      nickname: 'TestUser',
      avatar_url: 'https://example.com/avatar.jpg'
    };

    render(UserDisplay, {
      walletAddress: '0x1234567890123456789012345678901234567890',
      profile,
      size: 'md'
    });

    expect(screen.getByText('TestUser')).toBeInTheDocument();
  });

  it('should display formatted address when no profile exists', () => {
    render(UserDisplay, {
      walletAddress: '0x1234567890123456789012345678901234567890',
      profile: null,
      size: 'md'
    });

    expect(screen.getByText('0x1234...7890')).toBeInTheDocument();
  });

  it('should display avatar when profile has avatar_url', () => {
    const profile = {
      nickname: 'TestUser',
      avatar_url: 'https://example.com/avatar.jpg'
    };

    render(UserDisplay, {
      walletAddress: '0x1234567890123456789012345678901234567890',
      profile,
      size: 'md'
    });

    const avatar = screen.getByAltText('TestUser avatar');
    expect(avatar).toBeInTheDocument();
    expect(avatar.src).toBe('https://example.com/avatar.jpg');
  });

  it('should display initials when no avatar exists', () => {
    render(UserDisplay, {
      walletAddress: '0x1234567890123456789012345678901234567890',
      profile: null,
      size: 'md'
    });

    expect(screen.getByText('12')).toBeInTheDocument();
  });
});

describe('Leaderboard with Profiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch and display user profiles for top players', async () => {
    const mockPlayers = [
      {
        address: '0x1234567890123456789012345678901234567890',
        total_shots: 10,
        total_spent: '1.0',
        total_won: '0.5'
      },
      {
        address: '0x0987654321098765432109876543210987654321',
        total_shots: 8,
        total_spent: '0.8',
        total_won: '0.0'
      }
    ];

    const mockProfiles = [
      {
        wallet_address: '0x1234567890123456789012345678901234567890',
        nickname: 'TopPlayer',
        avatar_url: 'https://example.com/avatar1.jpg'
      }
    ];

    const { db } = await import('../src/lib/supabase.js');
    db.getTopPlayers.mockResolvedValue(mockPlayers);
    db.getUserProfiles.mockResolvedValue(mockProfiles);

    render(Leaderboard);

    await waitFor(() => {
      expect(db.getTopPlayers).toHaveBeenCalledWith(10, 'total_shots');
      expect(db.getUserProfiles).toHaveBeenCalledWith([
        '0x1234567890123456789012345678901234567890',
        '0x0987654321098765432109876543210987654321'
      ]);
    });

    // Should display nickname for first player
    await waitFor(() => {
      expect(screen.getByText('TopPlayer')).toBeInTheDocument();
    });

    // Should display formatted address for second player (no profile)
    await waitFor(() => {
      expect(screen.getByText('0x0987...4321')).toBeInTheDocument();
    });
  });

  it('should handle empty leaderboard gracefully', async () => {
    const { db } = await import('../src/lib/supabase.js');
    db.getTopPlayers.mockResolvedValue([]);
    db.getUserProfiles.mockResolvedValue([]);

    render(Leaderboard);

    await waitFor(() => {
      expect(screen.getByText('No players yet!')).toBeInTheDocument();
    });
  });

  it('should handle profile fetch errors gracefully', async () => {
    const mockPlayers = [
      {
        address: '0x1234567890123456789012345678901234567890',
        total_shots: 10,
        total_spent: '1.0',
        total_won: '0.5'
      }
    ];

    const { db } = await import('../src/lib/supabase.js');
    db.getTopPlayers.mockResolvedValue(mockPlayers);
    db.getUserProfiles.mockRejectedValue(new Error('Profile fetch failed'));

    render(Leaderboard);

    await waitFor(() => {
      // Should still display formatted address as fallback
      expect(screen.getByText('0x1234...7890')).toBeInTheDocument();
    });
  });
});

describe('ReferralLeaderboard with Profiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch and display user profiles for referrers', async () => {
    const mockLeaderboard = [
      {
        referrer_address: '0x1234567890123456789012345678901234567890',
        total_referrals: 5,
        successful_referrals: 3,
        success_rate: 60
      },
      {
        referrer_address: '0x0987654321098765432109876543210987654321',
        total_referrals: 3,
        successful_referrals: 2,
        success_rate: 67
      }
    ];

    const mockProfiles = [
      {
        wallet_address: '0x1234567890123456789012345678901234567890',
        nickname: 'TopReferrer',
        avatar_url: 'https://example.com/avatar1.jpg'
      }
    ];

    const { db } = await import('../src/lib/supabase.js');
    db.getReferralLeaderboard.mockResolvedValue(mockLeaderboard);
    db.getUserProfiles.mockResolvedValue(mockProfiles);

    render(ReferralLeaderboard);

    await waitFor(() => {
      expect(db.getReferralLeaderboard).toHaveBeenCalledWith({
        timeFilter: 'all',
        sortBy: 'successful_referrals',
        limit: 100
      });
      expect(db.getUserProfiles).toHaveBeenCalledWith([
        '0x1234567890123456789012345678901234567890',
        '0x0987654321098765432109876543210987654321'
      ]);
    });

    // Should display nickname for first referrer
    await waitFor(() => {
      expect(screen.getByText('TopReferrer')).toBeInTheDocument();
    });

    // Should display formatted address for second referrer (no profile)
    await waitFor(() => {
      expect(screen.getByText('0x0987...4321')).toBeInTheDocument();
    });
  });

  it('should handle empty referral leaderboard gracefully', async () => {
    const { db } = await import('../src/lib/supabase.js');
    db.getReferralLeaderboard.mockResolvedValue([]);
    db.getUserProfiles.mockResolvedValue([]);

    render(ReferralLeaderboard);

    await waitFor(() => {
      expect(screen.getByText('No Champions Yet')).toBeInTheDocument();
    });
  });
});