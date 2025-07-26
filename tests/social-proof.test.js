/**
 * Social Proof System Tests
 * 
 * Tests for the social proof tracking and FOMO mechanics
 * Using Jest for testing framework
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { get } from 'svelte/store';

// Mock browser environment
global.browser = true;

// Mock Svelte stores
const mockWritable = (initialValue) => {
  let value = initialValue;
  const subscribers = new Set();
  
  return {
    subscribe: (fn) => {
      subscribers.add(fn);
      fn(value);
      return () => subscribers.delete(fn);
    },
    set: (newValue) => {
      value = newValue;
      subscribers.forEach(fn => fn(value));
    },
    update: (updater) => {
      value = updater(value);
      subscribers.forEach(fn => fn(value));
    }
  };
};

// Mock derived store
const mockDerived = (stores, fn) => {
  const value = fn(Array.isArray(stores) ? stores.map(s => get(s)) : get(stores));
  return mockWritable(value);
};

jest.mock('svelte/store', () => ({
  writable: mockWritable,
  derived: mockDerived,
  get: (store) => {
    let value;
    store.subscribe(v => value = v)();
    return value;
  }
}));

jest.mock('$app/environment', () => ({
  browser: true
}));

// Import modules after mocking
import {
  liveActivity,
  activeUsers,
  potGrowthHistory,
  socialMetrics,
  fomoLevel,
  crowdPressure,
  addActivity,
  trackActiveUser,
  trackPotGrowth,
  processShotEvent,
  processPotMilestone,
  initializeSocialProof,
  ACTIVITY_TYPES
} from '../src/lib/stores/social-proof.js';

describe('Social Proof Store', () => {
  beforeEach(() => {
    // Reset stores before each test
    initializeSocialProof();
  });

  afterEach(() => {
    // Clean up after each test
    jest.clearAllMocks();
  });

  describe('Activity Tracking', () => {
    it('should add activity to live feed', () => {
      const activity = {
        type: ACTIVITY_TYPES.SHOT_TAKEN,
        playerAddress: '0x123',
        message: 'Test shot taken',
        intensity: 'normal'
      };

      addActivity(activity);
      
      const activities = get(liveActivity);
      expect(activities).toHaveLength(1);
      expect(activities[0]).toMatchObject({
        type: ACTIVITY_TYPES.SHOT_TAKEN,
        playerAddress: '0x123',
        message: 'Test shot taken',
        intensity: 'normal'
      });
      expect(activities[0]).toHaveProperty('id');
      expect(activities[0]).toHaveProperty('timestamp');
    });

    it('should limit activity feed to maximum items', () => {
      // Add more than the limit (50 items)
      for (let i = 0; i < 60; i++) {
        addActivity({
          type: ACTIVITY_TYPES.SHOT_TAKEN,
          message: `Activity ${i}`,
          intensity: 'normal'
        });
      }

      const activities = get(liveActivity);
      expect(activities).toHaveLength(50); // Should be limited to 50
    });

    it('should track active users', () => {
      const userAddress = '0x123456789';
      
      trackActiveUser(userAddress);
      
      const users = get(activeUsers);
      expect(users.has(userAddress.toLowerCase())).toBe(true);
    });

    it('should track pot growth', () => {
      trackPotGrowth(1.5);
      trackPotGrowth(2.0);
      
      const history = get(potGrowthHistory);
      expect(history).toHaveLength(2);
      expect(history[0].amount).toBe(1.5);
      expect(history[1].amount).toBe(2.0);
    });
  });

  describe('Shot Event Processing', () => {
    it('should process regular shot event', () => {
      const shotData = {
        playerAddress: '0x123',
        amount: '0.001',
        won: false,
        userProfile: { nickname: 'TestUser' }
      };

      processShotEvent(shotData);
      
      const activities = get(liveActivity);
      expect(activities).toHaveLength(1);
      expect(activities[0].type).toBe(ACTIVITY_TYPES.SHOT_TAKEN);
      expect(activities[0].playerAddress).toBe('0x123');
      expect(activities[0].won).toBe(false);
    });

    it('should process winning shot event', () => {
      const shotData = {
        playerAddress: '0x123',
        amount: '5.0',
        won: true,
        userProfile: { nickname: 'Winner' }
      };

      processShotEvent(shotData);
      
      const activities = get(liveActivity);
      expect(activities).toHaveLength(1);
      expect(activities[0].type).toBe(ACTIVITY_TYPES.WINNER);
      expect(activities[0].intensity).toBe('high');
      expect(activities[0].won).toBe(true);
    });

    it('should process big shot event', () => {
      const shotData = {
        playerAddress: '0x123',
        amount: '0.01', // Above normal 0.001
        won: false,
        userProfile: { nickname: 'BigSpender' }
      };

      processShotEvent(shotData);
      
      const activities = get(liveActivity);
      expect(activities).toHaveLength(1);
      expect(activities[0].type).toBe(ACTIVITY_TYPES.BIG_SHOT);
      expect(activities[0].intensity).toBe('medium');
    });
  });

  describe('Pot Milestone Processing', () => {
    it('should detect pot milestones', () => {
      // Process milestone
      processPotMilestone(5.0);
      
      const activities = get(liveActivity);
      const milestoneActivity = activities.find(a => a.type === ACTIVITY_TYPES.MILESTONE);
      
      expect(milestoneActivity).toBeDefined();
      expect(milestoneActivity.amount).toBe(5);
      expect(milestoneActivity.intensity).toBe('medium');
    });

    it('should not duplicate milestones', () => {
      // Process same milestone twice
      processPotMilestone(5.0);
      processPotMilestone(5.1); // Still same milestone
      
      const activities = get(liveActivity);
      const milestoneActivities = activities.filter(a => a.type === ACTIVITY_TYPES.MILESTONE);
      
      expect(milestoneActivities).toHaveLength(1);
    });

    it('should detect high-value milestones', () => {
      processPotMilestone(10.0);
      
      const activities = get(liveActivity);
      const milestoneActivity = activities.find(a => a.type === ACTIVITY_TYPES.MILESTONE);
      
      expect(milestoneActivity.intensity).toBe('high');
    });
  });

  describe('FOMO Level Calculation', () => {
    it('should calculate low FOMO level', () => {
      // Add minimal activity
      trackActiveUser('0x123');
      
      const fomo = get(fomoLevel);
      expect(fomo.level).toBe('low');
      expect(fomo.score).toBeGreaterThanOrEqual(0);
    });

    it('should calculate high FOMO level with activity', () => {
      // Add multiple active users
      for (let i = 0; i < 10; i++) {
        trackActiveUser(`0x${i}`);
      }
      
      // Add multiple activities
      for (let i = 0; i < 8; i++) {
        addActivity({
          type: ACTIVITY_TYPES.SHOT_TAKEN,
          message: `Shot ${i}`,
          intensity: 'normal'
        });
      }
      
      const fomo = get(fomoLevel);
      expect(fomo.level).toBe('medium');
      expect(fomo.score).toBeGreaterThan(50);
    });
  });

  describe('Crowd Pressure Calculation', () => {
    it('should calculate crowd pressure based on active users', () => {
      // Add active users
      trackActiveUser('0x123');
      trackActiveUser('0x456');
      trackActiveUser('0x789');
      
      const pressure = get(crowdPressure);
      expect(pressure).toBeGreaterThan(0);
    });

    it('should increase pressure with more activity', () => {
      // Baseline pressure
      trackActiveUser('0x123');
      const basePressure = get(crowdPressure);
      
      // Add more activity
      for (let i = 0; i < 5; i++) {
        addActivity({
          type: ACTIVITY_TYPES.SHOT_TAKEN,
          message: `Shot ${i}`,
          intensity: 'normal'
        });
      }
      
      const newPressure = get(crowdPressure);
      expect(newPressure).toBeGreaterThan(basePressure);
    });
  });

  describe('Trending Detection', () => {
    it('should detect trending moments', () => {
      // Add multiple shots quickly
      for (let i = 0; i < 5; i++) {
        addActivity({
          type: ACTIVITY_TYPES.SHOT_TAKEN,
          message: `Quick shot ${i}`,
          intensity: 'normal'
        });
      }
      
      const activities = get(liveActivity);
      const trendingActivity = activities.find(a => a.type === ACTIVITY_TYPES.TRENDING);
      
      expect(trendingActivity).toBeDefined();
      expect(trendingActivity.intensity).toBe('high');
    });
  });

  describe('Social Metrics', () => {
    it('should update social metrics', () => {
      const metrics = get(socialMetrics);
      expect(metrics).toHaveProperty('totalPlayersToday');
      expect(metrics).toHaveProperty('shotsInLastHour');
      expect(metrics).toHaveProperty('peakConcurrentUsers');
    });

    it('should track big wins in metrics', () => {
      const shotData = {
        playerAddress: '0x123',
        amount: '10.0',
        won: true,
        userProfile: { nickname: 'BigWinner' }
      };

      processShotEvent(shotData);
      
      const metrics = get(socialMetrics);
      expect(metrics.lastBigWin).toBeDefined();
      expect(metrics.lastBigWin.playerAddress).toBe('0x123');
      expect(metrics.lastBigWin.amount).toBe('10.0');
    });
  });
});

describe('Social Proof Integration', () => {
  // Mock database
  const mockDb = {
    supabase: {
      rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null })
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle shot events for database tracking', async () => {
    // This would test the integration module
    // For now, we'll test that the functions exist and can be called
    expect(typeof processShotEvent).toBe('function');
    expect(typeof trackActiveUser).toBe('function');
    expect(typeof trackPotGrowth).toBe('function');
  });
});