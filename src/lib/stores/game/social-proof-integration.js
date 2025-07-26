/**
 * Social Proof Integration Module
 * 
 * Integrates social proof tracking with the existing game store
 * Handles real-time updates and database synchronization
 */

import { get } from 'svelte/store';
import { browser } from '$app/environment';
import { 
  initializeSocialProof,
  processShotEvent,
  processPotMilestone,
  trackActiveUser,
  trackPotGrowth,
  updateSocialMetrics,
  addActivity,
  ACTIVITY_TYPES
} from '../social-proof.js';
import { db } from '../../database/index.js';

// Integration state
let isInitialized = false;
let updateInterval = null;
let lastPotAmount = 0;
let metricsUpdateTimer = null;

/**
 * Initialize social proof integration
 */
export async function initializeSocialProofIntegration() {
  if (!browser || isInitialized) return;
  
  try {
    console.log('🎯 Initializing social proof integration...');
    
    // Initialize the social proof store
    initializeSocialProof();
    
    // Load initial social metrics from database
    await loadSocialMetrics();
    
    // Start periodic updates
    startPeriodicUpdates();
    
    isInitialized = true;
    console.log('✅ Social proof integration initialized');
  } catch (error) {
    console.error('❌ Failed to initialize social proof integration:', error);
  }
}

/**
 * Handle shot event for social proof
 */
export async function handleShotEvent(shotData, userProfile = null) {
  if (!browser || !isInitialized) return;
  
  try {
    const { playerAddress, amount, won, txHash } = shotData;
    
    // Track in database
    await db.supabase?.rpc('track_user_activity', {
      p_user_address: playerAddress,
      p_activity_type: won ? 'winner' : 'shot_taken',
      p_activity_data: {
        amount,
        won,
        txHash,
        timestamp: Date.now()
      },
      p_intensity: won ? 'high' : (parseFloat(amount) > 0.001 ? 'medium' : 'normal')
    });
    
    // Process in social proof store
    processShotEvent({
      playerAddress,
      amount,
      won,
      userProfile
    });
    
    console.log('🎯 Shot event processed for social proof:', { playerAddress, amount, won });
  } catch (error) {
    console.error('❌ Failed to handle shot event for social proof:', error);
  }
}

/**
 * Handle pot update for social proof
 */
export async function handlePotUpdate(newPotAmount) {
  if (!browser || !isInitialized) return;
  
  try {
    const currentPot = parseFloat(newPotAmount) || 0;
    const previousPot = lastPotAmount;
    
    // Track pot growth in database
    if (previousPot > 0 && currentPot !== previousPot) {
      await db.supabase?.rpc('track_pot_growth', {
        p_pot_amount: currentPot,
        p_previous_amount: previousPot
      });
    }
    
    // Track in social proof store
    trackPotGrowth(currentPot);
    
    // Check for milestones
    processPotMilestone(currentPot);
    
    lastPotAmount = currentPot;
    
    console.log('💰 Pot update processed for social proof:', { previousPot, currentPot });
  } catch (error) {
    console.error('❌ Failed to handle pot update for social proof:', error);
  }
}

/**
 * Handle user activity tracking
 */
export async function handleUserActivity(userAddress, activityType = 'login', activityData = {}) {
  if (!browser || !isInitialized || !userAddress) return;
  
  try {
    // Track in database
    await db.supabase?.rpc('track_user_activity', {
      p_user_address: userAddress,
      p_activity_type: activityType,
      p_activity_data: activityData,
      p_intensity: 'normal'
    });
    
    // Track active user in social proof store
    trackActiveUser(userAddress);
    
    console.log('👤 User activity tracked:', { userAddress, activityType });
  } catch (error) {
    console.error('❌ Failed to track user activity:', error);
  }
}

/**
 * Handle winner event
 */
export async function handleWinnerEvent(winnerData, userProfile = null) {
  if (!browser || !isInitialized) return;
  
  try {
    const { winnerAddress, amount, txHash } = winnerData;
    
    // Track winner activity
    await db.supabase?.rpc('track_user_activity', {
      p_user_address: winnerAddress,
      p_activity_type: 'winner',
      p_activity_data: {
        amount,
        txHash,
        timestamp: Date.now()
      },
      p_intensity: 'extreme'
    });
    
    // Update social metrics with big win
    await updateSocialMetricsInDb({
      last_big_win: {
        playerAddress: winnerAddress,
        amount,
        timestamp: Date.now()
      }
    });
    
    // Add to activity feed
    addActivity({
      type: ACTIVITY_TYPES.WINNER,
      playerAddress: winnerAddress,
      amount,
      won: true,
      message: `🏆 ${userProfile?.nickname || formatAddress(winnerAddress)} won ${amount} ETH!`,
      intensity: 'extreme',
      userProfile
    });
    
    console.log('🏆 Winner event processed for social proof:', winnerData);
  } catch (error) {
    console.error('❌ Failed to handle winner event for social proof:', error);
  }
}

/**
 * Load social metrics from database
 */
async function loadSocialMetrics() {
  if (!db.supabase) return;
  
  try {
    const { data, error } = await db.supabase
      .from('social_metrics')
      .select('*')
      .eq('id', 1)
      .single();
    
    if (error) {
      console.warn('No social metrics found in database, using defaults');
      return;
    }
    
    if (data) {
      updateSocialMetrics({
        totalPlayersToday: data.total_players_today || 0,
        shotsInLastHour: data.shots_in_last_hour || 0,
        peakConcurrentUsers: data.peak_concurrent_users || 0,
        averagePotGrowth: parseFloat(data.average_pot_growth) || 0,
        lastBigWin: data.last_big_win,
        trendingMoment: data.trending_moment,
        lastMilestone: data.last_milestone || 0
      });
      
      console.log('📊 Social metrics loaded from database');
    }
  } catch (error) {
    console.error('❌ Failed to load social metrics:', error);
  }
}

/**
 * Update social metrics in database
 */
async function updateSocialMetricsInDb(metrics) {
  if (!db.supabase) return;
  
  try {
    await db.supabase.rpc('update_social_metrics', {
      p_metrics: metrics
    });
    
    console.log('📊 Social metrics updated in database');
  } catch (error) {
    console.error('❌ Failed to update social metrics in database:', error);
  }
}

/**
 * Start periodic updates
 */
function startPeriodicUpdates() {
  if (updateInterval) return;
  
  // Update metrics every 30 seconds
  updateInterval = setInterval(async () => {
    try {
      // Get current active user count
      const activeCount = await getActiveUserCount();
      
      // Update peak concurrent users if needed
      const currentMetrics = get({ subscribe: (fn) => fn({ peakConcurrentUsers: 0 }) });
      if (activeCount > (currentMetrics.peakConcurrentUsers || 0)) {
        await updateSocialMetricsInDb({
          peak_concurrent_users: activeCount
        });
        
        updateSocialMetrics({
          peakConcurrentUsers: activeCount
        });
      }
      
      // Cleanup old activity records periodically
      if (Math.random() < 0.1) { // 10% chance each interval
        await db.supabase?.rpc('cleanup_social_activity');
      }
    } catch (error) {
      console.error('❌ Error in periodic social proof update:', error);
    }
  }, 30000);
  
  // Update hourly metrics every 5 minutes
  metricsUpdateTimer = setInterval(async () => {
    try {
      await updateHourlyMetrics();
    } catch (error) {
      console.error('❌ Error updating hourly metrics:', error);
    }
  }, 5 * 60 * 1000);
}

/**
 * Get active user count from database
 */
async function getActiveUserCount() {
  if (!db.supabase) return 0;
  
  try {
    const { data, error } = await db.supabase.rpc('get_active_user_count', {
      p_timeout_minutes: 5
    });
    
    if (error) throw error;
    return data || 0;
  } catch (error) {
    console.error('❌ Failed to get active user count:', error);
    return 0;
  }
}

/**
 * Update hourly metrics
 */
async function updateHourlyMetrics() {
  if (!db.supabase) return;
  
  try {
    // Get shots in last hour
    const { data: recentShots, error } = await db.supabase
      .from('social_activity')
      .select('id')
      .eq('activity_type', 'shot_taken')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
    
    if (!error && recentShots) {
      await updateSocialMetricsInDb({
        shots_in_last_hour: recentShots.length
      });
      
      updateSocialMetrics({
        shotsInLastHour: recentShots.length
      });
    }
  } catch (error) {
    console.error('❌ Failed to update hourly metrics:', error);
  }
}

/**
 * Stop periodic updates
 */
export function stopSocialProofIntegration() {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
  
  if (metricsUpdateTimer) {
    clearInterval(metricsUpdateTimer);
    metricsUpdateTimer = null;
  }
  
  isInitialized = false;
  console.log('🛑 Social proof integration stopped');
}

/**
 * Format wallet address for display
 */
function formatAddress(address) {
  if (!address) return 'Unknown';
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

/**
 * Subscribe to real-time database changes
 */
export function subscribeSocialProofUpdates() {
  if (!db.supabase || !isInitialized) return null;
  
  try {
    // Subscribe to social activity changes
    const subscription = db.supabase
      .channel('social_proof_updates')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'social_activity'
      }, (payload) => {
        console.log('📡 Real-time social activity update:', payload);
        
        // Process the new activity in the social proof store
        if (payload.new) {
          const activity = payload.new;
          addActivity({
            type: activity.activity_type,
            playerAddress: activity.user_address,
            message: generateActivityMessage(activity),
            intensity: activity.intensity,
            timestamp: new Date(activity.created_at).getTime()
          });
        }
      })
      .subscribe();
    
    console.log('📡 Subscribed to social proof real-time updates');
    return subscription;
  } catch (error) {
    console.error('❌ Failed to subscribe to social proof updates:', error);
    return null;
  }
}

/**
 * Generate activity message from database record
 */
function generateActivityMessage(activity) {
  const address = formatAddress(activity.user_address);
  const data = activity.activity_data || {};
  
  switch (activity.activity_type) {
    case 'shot_taken':
      return `🎯 ${address} took a shot!`;
    case 'winner':
      return `🏆 ${address} won ${data.amount || '?'} ETH!`;
    case 'big_shot':
      return `💰 ${address} took a ${data.amount || 'big'} ETH shot!`;
    case 'milestone':
      return `🚀 Pot reached ${data.milestone || '?'} ETH!`;
    case 'trending':
      return `🔥 Viral moment detected!`;
    default:
      return `📢 ${address} is active!`;
  }
}