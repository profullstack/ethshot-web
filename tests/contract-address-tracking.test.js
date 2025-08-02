/**
 * Contract Address Tracking Test
 * 
 * Tests that all game data is properly associated with contract addresses
 * to prevent data contamination when multiple developers use different contracts.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../src/lib/database/index.js';

// Mock dependencies
vi.mock('../src/lib/database/client.js', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn()
  },
  TABLES: {
    SHOTS: 'shots',
    WINNERS: 'winners',
    PLAYERS: 'players',
    GAME_STATS: 'game_stats'
  }
}));

vi.mock('../src/lib/config.js', () => ({
  NETWORK_CONFIG: {
    CONTRACT_ADDRESS: '0x1234567890123456789012345678901234567890'
  }
}));

describe('Contract Address Tracking', () => {
  let mockSupabase;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock supabase client
    mockSupabase = {
      from: vi.fn(),
      rpc: vi.fn()
    };
    
    db.supabase = mockSupabase;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Shot Recording', () => {
    it('should record shots with contract address', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 1, player_address: '0xplayer123' },
            error: null
          })
        })
      });

      mockSupabase.from.mockReturnValue({
        insert: mockInsert
      });

      await db.recordShot({
        playerAddress: '0xplayer123',
        amount: '0.001',
        txHash: '0xtxhash123',
        blockNumber: 12345,
        timestamp: new Date().toISOString(),
        won: false,
        cryptoType: 'ETH',
        contractAddress: '0x1234567890123456789012345678901234567890'
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('shots');
      expect(mockInsert).toHaveBeenCalledWith({
        player_address: '0xplayer123',
        amount: '0.001',
        won: false,
        tx_hash: '0xtxhash123',
        block_number: 12345,
        timestamp: expect.any(String),
        crypto_type: 'ETH',
        contract_address: '0x1234567890123456789012345678901234567890'
      });
    });
  });

  describe('Winner Recording', () => {
    it('should record winners with contract address', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 1, winner_address: '0xwinner123' },
            error: null
          })
        })
      });

      mockSupabase.from.mockReturnValue({
        insert: mockInsert
      });

      await db.recordWinner({
        winnerAddress: '0xwinner123',
        amount: '0.005',
        txHash: '0xwintxhash123',
        blockNumber: 12346,
        timestamp: new Date().toISOString(),
        cryptoType: 'ETH',
        contractAddress: '0x1234567890123456789012345678901234567890'
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('winners');
      expect(mockInsert).toHaveBeenCalledWith({
        winner_address: '0xwinner123',
        amount: '0.005',
        tx_hash: '0xwintxhash123',
        block_number: 12346,
        timestamp: expect.any(String),
        crypto_type: 'ETH',
        contract_address: '0x1234567890123456789012345678901234567890'
      });
    });
  });

  describe('Game Stats', () => {
    it('should update game stats with contract address', async () => {
      const mockUpsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { contract_address: '0x1234567890123456789012345678901234567890' },
            error: null
          })
        })
      });

      mockSupabase.from.mockReturnValue({
        upsert: mockUpsert
      });

      await db.updateGameStats({
        totalShots: 100,
        totalPlayers: 50,
        totalPotWon: '1.5',
        currentPot: '0.1',
        lastWinner: '0xwinner123',
        lastWinAmount: '0.005'
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('game_stats');
      expect(mockUpsert).toHaveBeenCalledWith({
        contract_address: '0x1234567890123456789012345678901234567890',
        total_shots: 100,
        total_players: 50,
        total_pot_won: '1.5',
        current_pot: '0.1',
        last_winner: '0xwinner123',
        last_win_amount: '0.005',
        updated_at: expect.any(String)
      }, {
        onConflict: 'contract_address'
      });
    });

    it('should get game stats filtered by contract address', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [{ contract_address: '0x1234567890123456789012345678901234567890', total_shots: 100 }],
            error: null
          })
        })
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      });

      await db.getGameStats();

      expect(mockSupabase.from).toHaveBeenCalledWith('game_stats');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockSelect().eq).toHaveBeenCalledWith('contract_address', '0x1234567890123456789012345678901234567890');
    });
  });

  describe('Top Players', () => {
    it('should get top players filtered by contract address', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [
          {
            address: '0xplayer1',
            total_shots: 50,
            contract_address: '0x1234567890123456789012345678901234567890'
          }
        ],
        error: null
      });

      await db.getTopPlayers(10, 'total_shots');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_top_players_by_contract', {
        p_contract_address: '0x1234567890123456789012345678901234567890',
        player_limit: 10,
        order_by_field: 'total_shots'
      });
    });

    it('should fallback to direct query with contract filtering', async () => {
      // Mock RPC failure
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Function not found' }
      });

      const mockSelect = vi.fn().mockReturnValue({
        gt: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ address: '0xplayer1', total_shots: 50 }],
                error: null
              })
            })
          })
        })
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      });

      await db.getTopPlayers(10, 'total_shots');

      expect(mockSupabase.from).toHaveBeenCalledWith('players');
      expect(mockSelect().gt().order().limit().eq).toHaveBeenCalledWith('contract_address', '0x1234567890123456789012345678901234567890');
    });
  });

  describe('Recent Winners', () => {
    it('should get recent winners filtered by contract address', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({
              data: [
                {
                  winner_address: '0xwinner1',
                  amount: '0.005',
                  contract_address: '0x1234567890123456789012345678901234567890'
                }
              ],
              error: null
            })
          })
        })
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      });

      await db.getRecentWinners(10);

      expect(mockSupabase.from).toHaveBeenCalledWith('winners');
      expect(mockSelect().order().limit().or).toHaveBeenCalledWith(
        'contract_address.eq.0x1234567890123456789012345678901234567890,contract_address.is.null'
      );
    });
  });

  describe('Data Isolation', () => {
    it('should isolate data between different contract addresses', async () => {
      const contract1 = '0x1111111111111111111111111111111111111111';
      const contract2 = '0x2222222222222222222222222222222222222222';

      // Mock different contract addresses in config
      const originalConfig = vi.mocked(await import('../src/lib/config.js')).NETWORK_CONFIG;
      
      // Test contract 1 data
      originalConfig.CONTRACT_ADDRESS = contract1;
      
      const mockSelect1 = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [{ contract_address: contract1, total_shots: 100 }],
            error: null
          })
        })
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect1
      });

      const stats1 = await db.getGameStats();
      expect(mockSelect1().eq).toHaveBeenCalledWith('contract_address', contract1);

      // Test contract 2 data
      originalConfig.CONTRACT_ADDRESS = contract2;
      
      const mockSelect2 = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [{ contract_address: contract2, total_shots: 50 }],
            error: null
          })
        })
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect2
      });

      const stats2 = await db.getGameStats();
      expect(mockSelect2().eq).toHaveBeenCalledWith('contract_address', contract2);

      // Verify data isolation
      expect(stats1).not.toEqual(stats2);
    });
  });
});