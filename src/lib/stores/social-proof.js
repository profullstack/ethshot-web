/**
 * Social Proof Store
 * 
 * Manages real-time social proof data including:
 * - Live activity feed
 * - Active user tracking
 * - Pot growth monitoring
 * - FOMO indicators
 */

import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';

// Core stores
export const liveActivity = writable([]);
export const activeUsers = writable(new Set());
export const potGrowthHistory = writable([]);
export const socialMetrics = writable({
  totalPlayersToday: 0,
  shotsInLastHour: 0,
  averagePotGrowth: 0,
  peakConcurrentUsers: 0,
  lastBigWin: null,
  trendingMoment: null
});

// Configuration
const ACTIVITY_FEED_LIMIT = 50;
const ACTIVE_USER_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const POT_GROWTH_TRACKING_INTERVAL = 30 * 1000; // 30 seconds
const TRENDING_THRESHOLD = 5; // 5 shots in quick succession

// Activity types for the feed
export const ACTIVITY_TYPES = {
  SHOT_TAKEN: 'shot_taken',
  WINNER: 'winner',
  BIG_SHOT: 'big_shot', // Shots above average
  STREAK: 'streak', // Multiple shots from same user
  MILESTONE: 'milestone', // Pot milestones
  TRENDING: 'trending' // Viral moments
};

// Derived stores for computed values
export const recentActivity = derived(liveActivity, ($liveActivity) => {
  return $liveActivity.slice(0, 10); // Most recent 10 activities
});

export const activeUserCount = derived(activeUsers, ($activeUsers) => {
  return $activeUsers.size;
});

export const potGrowthRate = derived(potGrowthHistory, ($history) => {
  if ($history.length < 2) return 0;
  
  const recent = $history.slice(-5); // Last 5 data points
  if (recent.length < 2) return 0;
  
  const timeSpan = recent[recent.length - 1].timestamp - recent[0].timestamp;
  const potGrowth = recent[recent.length - 1].amount - recent[0].amount;
  
  return timeSpan > 0 ? (potGrowth / timeSpan) * 1000 : 0; // Growth per second
});

export const crowdPressure = derived(
  [activeUserCount, recentActivity, potGrowthRate],
  ([$activeUserCount, $recentActivity, $potGrowthRate]) => {
    const baseScore = Math.min($activeUserCount * 10, 100);
    const activityBonus = Math.min($recentActivity.length * 5, 50);
    const growthBonus = Math.min($potGrowthRate * 100, 50);
    
    return Math.min(baseScore + activityBonus + growthBonus, 200);
  }
);

export const fomoLevel = derived(
  [crowdPressure, potGrowthRate, socialMetrics],
  ([$crowdPressure, $potGrowthRate, $socialMetrics]) => {
    let level = 'low';
    
    if ($crowdPressure > 150 || $potGrowthRate > 0.01) {
      level = 'extreme';
    } else if ($crowdPressure > 100 || $potGrowthRate > 0.005) {
      level = 'high';
    } else if ($crowdPressure > 50 || $potGrowthRate > 0.001) {
      level = 'medium';
    }
    
    return {
      level,
      score: $crowdPressure,
      message: getFomoMessage(level, $socialMetrics)
    };
  }
);

/**
 * Get FOMO message based on level and metrics
 */
function getFomoMessage(level, metrics) {
  const messages = {
    extreme: [
      '🔥 The pot is exploding! Everyone is playing!',
      '⚡ Viral moment! Don\'t miss out!',
      '🚀 Peak activity detected!'
    ],
    high: [
      '📈 Pot growing fast! Jump in now!',
      '👥 Many players active right now!',
      '⏰ High activity period!'
    ],
    medium: [
      '📊 Steady activity detected',
      '👀 Others are watching the pot',
      '🎯 Good time to take a shot'
    ],
    low: [
      '🎲 Quiet moment - perfect opportunity',
      '💎 Early bird advantage',
      '🎪 Be the first to start the action'
    ]
  };
  
  const levelMessages = messages[level] || messages.low;
  return levelMessages[Math.floor(Math.random() * levelMessages.length)];
}

/**
 * Add activity to the live feed
 */
export function addActivity(activity) {
  if (!browser) return;
  
  const newActivity = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    ...activity
  };
  
  liveActivity.update(activities => {
    const updated = [newActivity, ...activities];
    return updated.slice(0, ACTIVITY_FEED_LIMIT);
  });
  
  // Check for trending moments
  checkForTrendingMoment(newActivity);
}

/**
 * Track active user
 */
export function trackActiveUser(userAddress) {
  if (!browser || !userAddress) return;
  
  activeUsers.update(users => {
    const updated = new Set(users);
    updated.add(userAddress.toLowerCase());
    return updated;
  });
  
  // Remove user after timeout
  setTimeout(() => {
    activeUsers.update(users => {
      const updated = new Set(users);
      updated.delete(userAddress.toLowerCase());
      return updated;
    });
  }, ACTIVE_USER_TIMEOUT);
}

/**
 * Track pot growth
 */
export function trackPotGrowth(amount) {
  if (!browser) return;
  
  const dataPoint = {
    timestamp: Date.now(),
    amount: parseFloat(amount) || 0
  };
  
  potGrowthHistory.update(history => {
    const updated = [...history, dataPoint];
    // Keep last 100 data points
    return updated.slice(-100);
  });
}

/**
 * Update social metrics
 */
export function updateSocialMetrics(updates) {
  if (!browser) return;
  
  socialMetrics.update(current => ({
    ...current,
    ...updates
  }));
}

/**
 * Check for trending moments
 */
function checkForTrendingMoment(activity) {
  const currentActivity = get(liveActivity);
  const recentShots = currentActivity
    .filter(a => a.type === ACTIVITY_TYPES.SHOT_TAKEN)
    .slice(0, TRENDING_THRESHOLD);
  
  if (recentShots.length >= TRENDING_THRESHOLD) {
    const timeSpan = recentShots[0].timestamp - recentShots[TRENDING_THRESHOLD - 1].timestamp;
    
    // If 5 shots in less than 2 minutes, it's trending
    if (timeSpan < 2 * 60 * 1000) {
      addActivity({
        type: ACTIVITY_TYPES.TRENDING,
        message: `🔥 ${TRENDING_THRESHOLD} shots in ${Math.round(timeSpan / 1000)}s!`,
        intensity: 'high'
      });
      
      updateSocialMetrics({
        trendingMoment: {
          timestamp: Date.now(),
          shotCount: TRENDING_THRESHOLD,
          timeSpan
        }
      });
    }
  }
}

/**
 * Process shot event for social proof
 */
export function processShotEvent(shotData) {
  if (!browser) return;
  
  const { playerAddress, amount, won, userProfile } = shotData;
  
  // Track active user
  trackActiveUser(playerAddress);
  
  // Determine activity type and message
  let activityType = ACTIVITY_TYPES.SHOT_TAKEN;
  let message = '';
  let intensity = 'normal';
  
  if (won) {
    activityType = ACTIVITY_TYPES.WINNER;
    message = `🏆 ${userProfile?.nickname || formatAddress(playerAddress)} won ${amount} ETH!`;
    intensity = 'high';
  } else {
    const shotAmount = parseFloat(amount);
    if (shotAmount > 0.001) { // Above normal shot cost
      activityType = ACTIVITY_TYPES.BIG_SHOT;
      message = `💰 ${userProfile?.nickname || formatAddress(playerAddress)} took a ${amount} ETH shot!`;
      intensity = 'medium';
    } else {
      message = `🎯 ${userProfile?.nickname || formatAddress(playerAddress)} took a shot!`;
    }
  }
  
  // Add to activity feed
  addActivity({
    type: activityType,
    playerAddress,
    amount,
    won,
    message,
    intensity,
    userProfile
  });
  
  // Update metrics
  socialMetrics.update(current => ({
    ...current,
    shotsInLastHour: current.shotsInLastHour + 1,
    lastBigWin: won ? { playerAddress, amount, timestamp: Date.now() } : current.lastBigWin
  }));
}

/**
 * Process pot milestone
 */
export function processPotMilestone(potAmount) {
  if (!browser) return;
  
  const milestones = [1, 2, 5, 10, 20, 50, 100]; // ETH milestones
  const currentPot = parseFloat(potAmount);
  
  for (const milestone of milestones) {
    if (currentPot >= milestone) {
      const lastMilestone = get(socialMetrics).lastMilestone;
      
      if (!lastMilestone || lastMilestone < milestone) {
        addActivity({
          type: ACTIVITY_TYPES.MILESTONE,
          message: `🚀 Pot reached ${milestone} ETH!`,
          amount: milestone,
          intensity: milestone >= 10 ? 'high' : 'medium'
        });
        
        updateSocialMetrics({
          lastMilestone: milestone
        });
        
        break;
      }
    }
  }
}

/**
 * Format wallet address for display
 */
function formatAddress(address) {
  if (!address) return 'Unknown';
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

/**
 * Initialize social proof tracking
 */
export function initializeSocialProof() {
  if (!browser) return;
  
  // Reset stores
  liveActivity.set([]);
  activeUsers.set(new Set());
  potGrowthHistory.set([]);
  
  // Initialize metrics
  updateSocialMetrics({
    totalPlayersToday: 0,
    shotsInLastHour: 0,
    averagePotGrowth: 0,
    peakConcurrentUsers: 0,
    lastBigWin: null,
    trendingMoment: null,
    lastMilestone: 0
  });
  
  console.log('🎯 Social proof tracking initialized');
}

/**
 * Cleanup social proof tracking
 */
export function cleanupSocialProof() {
  if (!browser) return;
  
  // Clear all stores
  liveActivity.set([]);
  activeUsers.set(new Set());
  potGrowthHistory.set([]);
  socialMetrics.set({});
  
  console.log('🧹 Social proof tracking cleaned up');
}