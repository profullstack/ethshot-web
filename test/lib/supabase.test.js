import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { db, formatAddress, formatEther, formatTimeAgo } from '../../src/lib/supabase.js';

// Mock Supabase client
const mockSupabase = {
  from: sinon.stub(),
  channel: sinon.stub(),
  removeChannel: sinon.stub()
};

const mockQuery = {
  select: sinon.stub(),
  insert: sinon.stub(),
  update: sinon.stub(),
  delete: sinon.stub(),
  eq: sinon.stub(),
  order: sinon.stub(),
  limit: sinon.stub(),
  single: sinon.stub(),
  maybeSingle: sinon.stub()
};

const mockChannel = {
  on: sinon.stub(),
  subscribe: sinon.stub(),
  unsubscribe: sinon.stub()
};

describe('Supabase Integration', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    
    // Reset all stubs
    Object.values(mockSupabase).forEach(stub => {
      if (typeof stub.reset === 'function') stub.reset();
    });
    Object.values(mockQuery).forEach(stub => {
      if (typeof stub.reset === 'function') stub.reset();
    });
    Object.values(mockChannel).forEach(stub => {
      if (typeof stub.reset === 'function') stub.reset();
    });

    // Set up default stub chains
    mockSupabase.from.returns(mockQuery);
    mockQuery.select.returns(mockQuery);
    mockQuery.insert.returns(mockQuery);
    mockQuery.update.returns(mockQuery);
    mockQuery.delete.returns(mockQuery);
    mockQuery.eq.returns(mockQuery);
    mockQuery.order.returns(mockQuery);
    mockQuery.limit.returns(mockQuery);
    mockQuery.single.returns(mockQuery);
    mockQuery.maybeSingle.returns(mockQuery);
    
    mockSupabase.channel.returns(mockChannel);
    mockChannel.on.returns(mockChannel);
    mockChannel.subscribe.returns(mockChannel);

    // Mock the Supabase client in the db object
    db.supabase = mockSupabase;
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('Database Operations', () => {
    describe('getRecentWinners', () => {
      it('should fetch recent winners successfully', async () => {
        const mockWinners = [
          {
            id: 1,
            player_address: '0x1234567890123456789012345678901234567890',
            amount: '1.5',
            timestamp: '2023-01-01T00:00:00Z',
            tx_hash: '0xhash123'
          }
        ];

        mockQuery.select.resolves({ data: mockWinners, error: null });

        const result = await db.getRecentWinners(10);

        expect(mockSupabase.from).to.have.been.calledWith('winners');
        expect(mockQuery.select).to.have.been.calledWith('*');
        expect(mockQuery.order).to.have.been.calledWith('timestamp', { ascending: false });
        expect(mockQuery.limit).to.have.been.calledWith(10);
        expect(result).to.deep.equal(mockWinners);
      });

      it('should handle database errors', async () => {
        mockQuery.select.resolves({ data: null, error: { message: 'Database error' } });

        try {
          await db.getRecentWinners(10);
          expect.fail('Should have thrown an error');
        } catch (error) {
          expect(error.message).to.equal('Database error');
        }
      });

      it('should use default limit when not provided', async () => {
        mockQuery.select.resolves({ data: [], error: null });

        await db.getRecentWinners();

        expect(mockQuery.limit).to.have.been.calledWith(20);
      });
    });

    describe('getTopPlayers', () => {
      it('should fetch top players successfully', async () => {
        const mockPlayers = [
          {
            player_address: '0x1234567890123456789012345678901234567890',
            total_won: '5.0',
            total_shots: 100,
            win_rate: 0.05
          }
        ];

        mockQuery.select.resolves({ data: mockPlayers, error: null });

        const result = await db.getTopPlayers(10);

        expect(mockSupabase.from).to.have.been.calledWith('players');
        expect(mockQuery.order).to.have.been.calledWith('total_won', { ascending: false });
        expect(mockQuery.limit).to.have.been.calledWith(10);
        expect(result).to.deep.equal(mockPlayers);
      });
    });

    describe('getPlayerStats', () => {
      it('should fetch player stats successfully', async () => {
        const mockStats = {
          player_address: '0x1234567890123456789012345678901234567890',
          total_shots: 50,
          total_spent: '0.05',
          total_won: '2.0',
          win_rate: 0.04,
          rank: 5
        };

        mockQuery.maybeSingle.resolves({ data: mockStats, error: null });

        const result = await db.getPlayerStats('0x1234567890123456789012345678901234567890');

        expect(mockSupabase.from).to.have.been.calledWith('players');
        expect(mockQuery.eq).to.have.been.calledWith('player_address', '0x1234567890123456789012345678901234567890');
        expect(result).to.deep.equal(mockStats);
      });

      it('should return null for non-existent player', async () => {
        mockQuery.maybeSingle.resolves({ data: null, error: null });

        const result = await db.getPlayerStats('0xnonexistent');

        expect(result).to.be.null;
      });
    });

    describe('getCurrentSponsor', () => {
      it('should fetch current active sponsor', async () => {
        const mockSponsor = {
          sponsor_address: '0x1234567890123456789012345678901234567890',
          name: 'Test Sponsor',
          logo_url: 'https://example.com/logo.png',
          active: true
        };

        mockQuery.maybeSingle.resolves({ data: mockSponsor, error: null });

        const result = await db.getCurrentSponsor();

        expect(mockSupabase.from).to.have.been.calledWith('sponsors');
        expect(mockQuery.eq).to.have.been.calledWith('active', true);
        expect(result).to.deep.equal(mockSponsor);
      });
    });

    describe('getGameStats', () => {
      it('should fetch game statistics', async () => {
        const mockStats = {
          total_shots: 1000,
          total_pot: '10.5',
          total_winners: 50,
          total_players: 200
        };

        mockQuery.single.resolves({ data: mockStats, error: null });

        const result = await db.getGameStats();

        expect(mockSupabase.from).to.have.been.calledWith('game_stats');
        expect(result).to.deep.equal(mockStats);
      });
    });
  });

  describe('Data Recording', () => {
    describe('recordShot', () => {
      it('should record a shot successfully', async () => {
        const shotData = {
          player_address: '0x1234567890123456789012345678901234567890',
          amount: '0.001',
          won: false,
          tx_hash: '0xhash123',
          block_number: 12345,
          timestamp: '2023-01-01T00:00:00Z'
        };

        mockQuery.insert.resolves({ data: shotData, error: null });

        const result = await db.recordShot(shotData);

        expect(mockSupabase.from).to.have.been.calledWith('shots');
        expect(mockQuery.insert).to.have.been.calledWith(shotData);
        expect(result).to.deep.equal(shotData);
      });

      it('should handle recording errors', async () => {
        const shotData = { player_address: '0xinvalid' };
        mockQuery.insert.resolves({ data: null, error: { message: 'Invalid data' } });

        try {
          await db.recordShot(shotData);
          expect.fail('Should have thrown an error');
        } catch (error) {
          expect(error.message).to.equal('Invalid data');
        }
      });
    });

    describe('recordWinner', () => {
      it('should record a winner successfully', async () => {
        const winnerData = {
          player_address: '0x1234567890123456789012345678901234567890',
          amount: '5.0',
          tx_hash: '0xhash123',
          block_number: 12345,
          timestamp: '2023-01-01T00:00:00Z'
        };

        mockQuery.insert.resolves({ data: winnerData, error: null });

        const result = await db.recordWinner(winnerData);

        expect(mockSupabase.from).to.have.been.calledWith('winners');
        expect(mockQuery.insert).to.have.been.calledWith(winnerData);
        expect(result).to.deep.equal(winnerData);
      });
    });

    describe('recordSponsor', () => {
      it('should record a sponsor successfully', async () => {
        const sponsorData = {
          sponsor_address: '0x1234567890123456789012345678901234567890',
          name: 'Test Sponsor',
          logo_url: 'https://example.com/logo.png',
          amount: '0.05',
          active: true
        };

        mockQuery.insert.resolves({ data: sponsorData, error: null });

        const result = await db.recordSponsor(sponsorData);

        expect(mockSupabase.from).to.have.been.calledWith('sponsors');
        expect(mockQuery.insert).to.have.been.calledWith(sponsorData);
        expect(result).to.deep.equal(sponsorData);
      });
    });
  });

  describe('Real-time Subscriptions', () => {
    describe('subscribeToWinners', () => {
      it('should set up winner subscription', () => {
        const callback = sinon.stub();
        
        db.subscribeToWinners(callback);

        expect(mockSupabase.channel).to.have.been.calledWith('winners');
        expect(mockChannel.on).to.have.been.calledWith(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'winners' },
          callback
        );
        expect(mockChannel.subscribe).to.have.been.called;
      });

      it('should return subscription object', () => {
        const callback = sinon.stub();
        
        const subscription = db.subscribeToWinners(callback);

        expect(subscription).to.equal(mockChannel);
      });
    });

    describe('subscribeToShots', () => {
      it('should set up shots subscription', () => {
        const callback = sinon.stub();
        
        db.subscribeToShots(callback);

        expect(mockSupabase.channel).to.have.been.calledWith('shots');
        expect(mockChannel.on).to.have.been.calledWith(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'shots' },
          callback
        );
        expect(mockChannel.subscribe).to.have.been.called;
      });
    });

    describe('subscribeToSponsors', () => {
      it('should set up sponsors subscription', () => {
        const callback = sinon.stub();
        
        db.subscribeToSponsors(callback);

        expect(mockSupabase.channel).to.have.been.calledWith('sponsors');
        expect(mockChannel.on).to.have.been.calledWith(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'sponsors' },
          callback
        );
        expect(mockChannel.subscribe).to.have.been.called;
      });
    });
  });

  describe('Utility Functions', () => {
    describe('formatAddress', () => {
      it('should format full address correctly', () => {
        const address = '0x1234567890123456789012345678901234567890';
        const formatted = formatAddress(address);
        
        expect(formatted).to.equal('0x1234...7890');
      });

      it('should handle null address', () => {
        const formatted = formatAddress(null);
        
        expect(formatted).to.equal('');
      });

      it('should handle undefined address', () => {
        const formatted = formatAddress(undefined);
        
        expect(formatted).to.equal('');
      });

      it('should handle short address', () => {
        const shortAddress = '0x1234';
        const formatted = formatAddress(shortAddress);
        
        expect(formatted).to.equal('0x1234');
      });

      it('should handle empty string', () => {
        const formatted = formatAddress('');
        
        expect(formatted).to.equal('');
      });
    });

    describe('formatEther', () => {
      it('should format ether amount correctly', () => {
        const formatted = formatEther('1500000000000000000'); // 1.5 ETH
        
        expect(formatted).to.equal('1.5');
      });

      it('should handle small amounts', () => {
        const formatted = formatEther('1000000000000000'); // 0.001 ETH
        
        expect(formatted).to.equal('0.001');
      });

      it('should handle zero', () => {
        const formatted = formatEther('0');
        
        expect(formatted).to.equal('0.0');
      });

      it('should handle string input', () => {
        const formatted = formatEther('1000000000000000000');
        
        expect(formatted).to.equal('1.0');
      });
    });

    describe('formatTimeAgo', () => {
      let clock;

      beforeEach(() => {
        // Mock current time to 2023-01-01 12:00:00
        clock = sinon.useFakeTimers(new Date('2023-01-01T12:00:00Z').getTime());
      });

      afterEach(() => {
        clock.restore();
      });

      it('should format seconds ago', () => {
        const timestamp = '2023-01-01T11:59:30Z'; // 30 seconds ago
        const formatted = formatTimeAgo(timestamp);
        
        expect(formatted).to.equal('30s ago');
      });

      it('should format minutes ago', () => {
        const timestamp = '2023-01-01T11:55:00Z'; // 5 minutes ago
        const formatted = formatTimeAgo(timestamp);
        
        expect(formatted).to.equal('5m ago');
      });

      it('should format hours ago', () => {
        const timestamp = '2023-01-01T10:00:00Z'; // 2 hours ago
        const formatted = formatTimeAgo(timestamp);
        
        expect(formatted).to.equal('2h ago');
      });

      it('should format days ago', () => {
        const timestamp = '2022-12-30T12:00:00Z'; // 2 days ago
        const formatted = formatTimeAgo(timestamp);
        
        expect(formatted).to.equal('2d ago');
      });

      it('should handle just now', () => {
        const timestamp = '2023-01-01T12:00:00Z'; // now
        const formatted = formatTimeAgo(timestamp);
        
        expect(formatted).to.equal('just now');
      });

      it('should handle invalid timestamp', () => {
        const formatted = formatTimeAgo('invalid-date');
        
        expect(formatted).to.equal('unknown');
      });

      it('should handle null timestamp', () => {
        const formatted = formatTimeAgo(null);
        
        expect(formatted).to.equal('unknown');
      });
    });
  });
});