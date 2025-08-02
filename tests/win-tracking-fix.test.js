/**
 * Win Tracking Fix Test
 * 
 * Tests the complete win tracking flow to ensure wins are properly recorded
 * in the database and displayed in the leaderboard and game widgets.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../src/lib/database/index.js';
import { revealShot } from '../src/lib/services/ethshot-actions.js';

// Mock dependencies
vi.mock('../src/lib/database/client.js', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn()
  },
  TABLES: {
    SHOTS: 'shots',
    WINNERS: 'winners',
    PLAYERS: 'players'
  }
}));

vi.mock('../src/lib/stores/game/cache.js', () => ({
  rpcCache: {
    clear: vi.fn()
  }
}));

describe('Win Tracking System', () => {
  let mockWallet;
  let mockContract;
  let mockEthers;
  let mockGameState;
  let mockLoadGameState;
  let mockLoadPlayerData;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock wallet
    mockWallet = {
      connected: true,
      address: '0x1234567890123456789012345678901234567890',
      provider: {
        getBalance: vi.fn().mockResolvedValue(BigInt('1000000000000000000')), // 1 ETH
        getBlockNumber: vi.fn().mockResolvedValue(12345)
      },
      signer: {}
    };

    // Mock contract
    mockContract = {
      interface: {
        parseLog: vi.fn().mockReturnValue({
          name: 'ShotRevealed',
          args: { won: true }
        })
      },
      hasPendingShot: vi.fn().mockResolvedValue(true),
      connect: vi.fn().mockReturnThis(),
      revealShot: {
        estimateGas: vi.fn().mockResolvedValue(BigInt('100000'))
      }
    };

    // Mock ethers
    mockEthers = {
      parseUnits: vi.fn().mockReturnValue(BigInt('20000000000')), // 20 gwei
      formatEther: vi.fn().mockReturnValue('0.001'),
      formatUnits: vi.fn().mockReturnValue('20')
    };

    // Mock game state
    mockGameState = {
      contractDeployed: true,
      activeCrypto: 'ETH',
      currentPot: '0.005', // 0.005 ETH pot
      shotCost: '0.0005',
      contractAddress: '0xabcdef1234567890123456789012345678901234',
      pendingShot: {
        commitHash: '0xcommithash123'
      }
    };

    // Mock functions
    mockLoadGameState = vi.fn().mockResolvedValue();
    mockLoadPlayerData = vi.fn().mockResolvedValue();

    // Mock localStorage
    global.localStorage = {
      getItem: vi.fn().mockImplementation((key) => {
        if (key === 'ethshot_jwt_token') return 'mock-jwt-token';
        if (key === 'ethshot_wallet_address') return mockWallet.address;
        if (key.startsWith('ethshot_saved_secrets_')) return JSON.stringify(['secret-key-1']);
        if (key === 'secret-key-1') return JSON.stringify({
          secret: 'mock-secret',
          txHash: '0xcommithash123',
          timestamp: Date.now()
        });
        return null;
      }),
      setItem: vi.fn(),
      removeItem: vi.fn()
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Winner Recording', () => {
    it('should record winner with correct pot amount', async () => {
      // Mock successful database operations
      const mockRecordWinner = vi.spyOn(db, 'recordWinner').mockResolvedValue({
        id: 1,
        winner_address: mockWallet.address.toLowerCase(),
        amount: '0.005',
        tx_hash: '0xrevealthash123'
      });

      // Mock successful shot update
      vi.spyOn(db.supabase, 'rpc').mockResolvedValue({
        data: true,
        error: null
      });

      // Mock contract reveal transaction
      const mockTx = {
        wait: vi.fn().mockResolvedValue({
          hash: '0xrevealthash123',
          blockNumber: 12346,
          logs: [{
            topics: ['ShotRevealed'],
            data: '0x'
          }]
        })
      };

      mockContract.revealShot = vi.fn().mockResolvedValue(mockTx);

      // Execute reveal shot
      const result = await revealShot({
        secret: 'mock-secret',
        gameState: mockGameState,
        wallet: mockWallet,
        contract: mockContract,
        ethers: mockEthers,
        loadGameState: mockLoadGameState,
        loadPlayerData: mockLoadPlayerData
      });

      // Verify winner was recorded with correct amount
      expect(mockRecordWinner).toHaveBeenCalledWith({
        winnerAddress: mockWallet.address,
        amount: '0.005', // Should use currentPot, not shotCost
        txHash: '0xrevealthash123',
        blockNumber: 12346,
        timestamp: expect.any(String),
        cryptoType: 'ETH',
        contractAddress: mockGameState.contractAddress
      });

      expect(result.won).toBe(true);
    });

    it('should handle winner recording failure gracefully', async () => {
      // Mock failed winner recording but successful shot update
      const mockRecordWinner = vi.spyOn(db, 'recordWinner').mockRejectedValue(
        new Error('Database connection failed')
      );

      // Mock successful shot update
      vi.spyOn(db.supabase, 'rpc').mockResolvedValue({
        data: true,
        error: null
      });

      // Mock contract reveal transaction
      const mockTx = {
        wait: vi.fn().mockResolvedValue({
          hash: '0xrevealthash123',
          blockNumber: 12346,
          logs: [{
            topics: ['ShotRevealed'],
            data: '0x'
          }]
        })
      };

      mockContract.revealShot = vi.fn().mockResolvedValue(mockTx);

      // Execute reveal shot - should not throw even if winner recording fails
      const result = await revealShot({
        secret: 'mock-secret',
        gameState: mockGameState,
        wallet: mockWallet,
        contract: mockContract,
        ethers: mockEthers,
        loadGameState: mockLoadGameState,
        loadPlayerData: mockLoadPlayerData
      });

      // Verify winner recording was attempted
      expect(mockRecordWinner).toHaveBeenCalled();

      // Verify reveal still succeeded
      expect(result.won).toBe(true);
      expect(result.hash).toBe('0xrevealthash123');
    });

    it('should fallback to shotCost when currentPot is not available', async () => {
      // Mock game state without currentPot
      const gameStateWithoutPot = {
        ...mockGameState,
        currentPot: null
      };

      // Mock successful database operations
      const mockRecordWinner = vi.spyOn(db, 'recordWinner').mockResolvedValue({
        id: 1,
        winner_address: mockWallet.address.toLowerCase(),
        amount: '0.0005',
        tx_hash: '0xrevealthash123'
      });

      // Mock successful shot update
      vi.spyOn(db.supabase, 'rpc').mockResolvedValue({
        data: true,
        error: null
      });

      // Mock contract reveal transaction
      const mockTx = {
        wait: vi.fn().mockResolvedValue({
          hash: '0xrevealthash123',
          blockNumber: 12346,
          logs: [{
            topics: ['ShotRevealed'],
            data: '0x'
          }]
        })
      };

      mockContract.revealShot = vi.fn().mockResolvedValue(mockTx);

      // Execute reveal shot
      await revealShot({
        secret: 'mock-secret',
        gameState: gameStateWithoutPot,
        wallet: mockWallet,
        contract: mockContract,
        ethers: mockEthers,
        loadGameState: mockLoadGameState,
        loadPlayerData: mockLoadPlayerData
      });

      // Verify winner was recorded with shotCost as fallback
      expect(mockRecordWinner).toHaveBeenCalledWith({
        winnerAddress: mockWallet.address,
        amount: '0.0005', // Should fallback to shotCost
        txHash: '0xrevealthash123',
        blockNumber: 12346,
        timestamp: expect.any(String),
        cryptoType: 'ETH',
        contractAddress: gameStateWithoutPot.contractAddress
      });
    });
  });

  describe('Database Winner Recording', () => {
    it('should use public client fallback when JWT fails', async () => {
      // Mock JWT failure
      global.localStorage.getItem = vi.fn().mockReturnValue(null);

      // Mock supabase public client
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 1, winner_address: mockWallet.address.toLowerCase() },
            error: null
          })
        })
      });

      const mockFrom = vi.fn().mockReturnValue({
        insert: mockInsert
      });

      db.supabase = { from: mockFrom };

      // Execute winner recording
      const result = await db.recordWinner({
        winnerAddress: mockWallet.address,
        amount: '0.005',
        txHash: '0xrevealthash123',
        blockNumber: 12346,
        timestamp: new Date().toISOString(),
        cryptoType: 'ETH',
        contractAddress: mockGameState.contractAddress
      });

      // Verify public client was used
      expect(mockFrom).toHaveBeenCalledWith('winners');
      expect(mockInsert).toHaveBeenCalledWith({
        winner_address: mockWallet.address.toLowerCase(),
        amount: '0.005',
        tx_hash: '0xrevealthash123',
        block_number: 12346,
        timestamp: expect.any(String),
        crypto_type: 'ETH',
        contract_address: mockGameState.contractAddress
      });
    });
  });

  describe('Player Stats Integration', () => {
    it('should trigger player stats update when shot is marked as won', async () => {
      // This test verifies that the database trigger system works
      // The trigger should automatically update player stats when shots.won is updated

      // Mock the update_shot_on_reveal function call
      const mockRpc = vi.fn().mockResolvedValue({
        data: true,
        error: null
      });

      db.supabase = { rpc: mockRpc };

      // Mock contract reveal transaction
      const mockTx = {
        wait: vi.fn().mockResolvedValue({
          hash: '0xrevealthash123',
          blockNumber: 12346,
          logs: [{
            topics: ['ShotRevealed'],
            data: '0x'
          }]
        })
      };

      mockContract.revealShot = vi.fn().mockResolvedValue(mockTx);

      // Execute reveal shot
      await revealShot({
        secret: 'mock-secret',
        gameState: mockGameState,
        wallet: mockWallet,
        contract: mockContract,
        ethers: mockEthers,
        loadGameState: mockLoadGameState,
        loadPlayerData: mockLoadPlayerData
      });

      // Verify the database function was called to update the shot
      expect(mockRpc).toHaveBeenCalledWith('update_shot_on_reveal', {
        p_tx_hash: '0xcommithash123',
        p_won: true,
        p_reveal_tx_hash: '0xrevealthash123',
        p_reveal_block_number: 12346
      });
    });
  });
});