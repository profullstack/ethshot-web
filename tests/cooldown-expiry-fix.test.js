/**
 * Test for Cooldown Expiry Fix
 * 
 * This test verifies that the GameButton component properly updates
 * the canShoot state when the cooldown timer expires.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import { writable, get } from 'svelte/store';
import GameButton from '../src/lib/components/GameButton.svelte';

// Mock the game store
const mockGameStore = {
  loadPlayerData: vi.fn().mockResolvedValue(undefined)
};

// Mock stores
const mockWalletStore = writable({
  connected: true,
  address: '0x1234567890123456789012345678901234567890'
});

const mockCanTakeShot = writable(false);
const mockCooldownRemaining = writable(5); // 5 seconds cooldown
const mockIsLoading = writable(false);
const mockContractDeployed = writable(true);
const mockGameError = writable(null);
const mockCurrentPot = writable('1.5');
const mockIsConnected = writable(true);
const mockIsCorrectNetwork = writable(true);

// Mock the imports
vi.mock('../src/lib/stores/game/index.js', () => ({
  gameStore: mockGameStore,
  canTakeShot: mockCanTakeShot,
  cooldownRemaining: mockCooldownRemaining,
  isLoading: mockIsLoading,
  contractDeployed: mockContractDeployed,
  gameError: mockGameError,
  currentPot: mockCurrentPot
}));

vi.mock('../src/lib/stores/wallet.js', () => ({
  walletStore: mockWalletStore,
  isConnected: mockIsConnected,
  isCorrectNetwork: mockIsCorrectNetwork
}));

vi.mock('../src/lib/stores/toast.js', () => ({
  toastStore: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn()
  }
}));

vi.mock('../src/lib/config.js', () => ({
  GAME_CONFIG: {
    SHOT_COST_ETH: '0.001',
    FIRST_SHOT_COST_ETH: '0.0005',
    WIN_PERCENTAGE: 10,
    WINNER_PERCENTAGE: 90,
    COOLDOWN_SECONDS: 300,
    SPONSOR_COST_ETH: '0.01'
  },
  NETWORK_CONFIG: {
    CHAIN_ID: '0x1'
  },
  formatEth: (value) => value,
  formatTime: (seconds) => `${seconds}s`
}));

describe('GameButton Cooldown Expiry Fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset store values
    mockCanTakeShot.set(false);
    mockCooldownRemaining.set(5);
    mockIsLoading.set(false);
    mockContractDeployed.set(true);
    mockGameError.set(null);
    mockCurrentPot.set('1.5');
    mockIsConnected.set(true);
    mockIsCorrectNetwork.set(true);
    mockWalletStore.set({
      connected: true,
      address: '0x1234567890123456789012345678901234567890'
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should show cooldown button when cooldown is active', async () => {
    render(GameButton);
    
    // Should show cooldown button
    expect(screen.getByText('Cooldown Active')).toBeInTheDocument();
    expect(screen.getByText(/Next shot in/)).toBeInTheDocument();
  });

  it('should refresh player data when cooldown expires', async () => {
    render(GameButton);
    
    // Initially showing cooldown
    expect(screen.getByText('Cooldown Active')).toBeInTheDocument();
    
    // Simulate cooldown expiring
    mockCooldownRemaining.set(0);
    
    // Wait for the timer to process the cooldown expiry
    await waitFor(() => {
      expect(mockGameStore.loadPlayerData).toHaveBeenCalledWith('0x1234567890123456789012345678901234567890');
    }, { timeout: 2000 });
    
    // Verify loadPlayerData was called when cooldown expired
    expect(mockGameStore.loadPlayerData).toHaveBeenCalledTimes(1);
  });

  it('should show take shot button after cooldown expires and canShoot is updated', async () => {
    render(GameButton);
    
    // Initially showing cooldown
    expect(screen.getByText('Cooldown Active')).toBeInTheDocument();
    
    // Simulate cooldown expiring and canShoot being updated
    mockCooldownRemaining.set(0);
    mockCanTakeShot.set(true);
    
    // Wait for UI to update
    await waitFor(() => {
      expect(screen.getByText('🎯 TAKE SHOT')).toBeInTheDocument();
    });
    
    // Should no longer show "Cannot Take Shot"
    expect(screen.queryByText('Cannot Take Shot')).not.toBeInTheDocument();
  });

  it('should not show "Cannot Take Shot" after cooldown expires', async () => {
    render(GameButton);
    
    // Start with cooldown active
    expect(screen.getByText('Cooldown Active')).toBeInTheDocument();
    
    // Simulate cooldown expiring
    mockCooldownRemaining.set(0);
    
    // Wait a moment for the timer to process
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    // Update canShoot to true (simulating successful loadPlayerData)
    mockCanTakeShot.set(true);
    
    // Wait for UI to update
    await waitFor(() => {
      expect(screen.queryByText('Cannot Take Shot')).not.toBeInTheDocument();
    });
    
    // Should show the take shot button instead
    expect(screen.getByText('🎯 TAKE SHOT')).toBeInTheDocument();
  });

  it('should handle loadPlayerData errors gracefully', async () => {
    // Mock loadPlayerData to throw an error
    mockGameStore.loadPlayerData.mockRejectedValueOnce(new Error('Network error'));
    
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(GameButton);
    
    // Simulate cooldown expiring
    mockCooldownRemaining.set(0);
    
    // Wait for the error to be handled
    await waitFor(() => {
      expect(mockGameStore.loadPlayerData).toHaveBeenCalled();
    });
    
    // Should have logged the error
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to refresh player data after cooldown'),
      expect.any(Error)
    );
    
    consoleSpy.mockRestore();
  });

  it('should not call loadPlayerData if wallet is not connected', async () => {
    // Set wallet as disconnected
    mockWalletStore.set({ connected: false, address: null });
    mockIsConnected.set(false);
    
    render(GameButton);
    
    // Simulate cooldown expiring
    mockCooldownRemaining.set(0);
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    // Should not have called loadPlayerData
    expect(mockGameStore.loadPlayerData).not.toHaveBeenCalled();
  });
});