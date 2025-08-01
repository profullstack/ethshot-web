/**
 * Contract Operations Module
 * 
 * Handles blockchain contract interactions for both ETH-only and multi-crypto modes
 */

import { browser } from '$app/environment';
import { get } from 'svelte/store';
import { getActiveAdapter } from '../../crypto/adapters/index.js';
import { NETWORK_CONFIG } from '../../config.js';
import { rpcCache, retryWithBackoff } from './cache.js';
import { 
  ETH_SHOT_ABI, 
  createProviderWithRetry, 
  updateUSDValues,
  checkPotMilestones,
  validateContractDeployment,
  handleContractError,
  safeBigIntToNumber
} from './utils.js';
import { notifyPotMilestone } from '../../utils/notifications.js';

/**
 * Load game state from contract/program and database
 * @param {Object} params - Parameters object
 * @param {Object} params.state - Current game state
 * @param {Object} params.contract - Contract instance (ETH mode)
 * @param {Object} params.ethers - Ethers library (ETH mode)
 * @param {Object} params.db - Database instance
 * @param {Function} params.updateState - State update function
 */
export const loadGameState = async ({ state, contract, ethers, db, updateState }) => {
  if (!browser) return;

  try {
    let contractBalance, houseFunds, shotCost, sponsorCost, currentSponsor, recentWinners;

    if (state.isMultiCryptoMode) {
      // Multi-crypto mode: use adapter
      const adapter = getActiveAdapter();
      if (!adapter) {
        console.warn('No active adapter for loading game state');
        return;
      }

      // Check cache first
      contractBalance = rpcCache.get('contractBalance');
      houseFunds = rpcCache.get('houseFunds');
      shotCost = rpcCache.get('shotCost');
      sponsorCost = rpcCache.get('sponsorCost');
      currentSponsor = rpcCache.get('currentSponsor');
      recentWinners = rpcCache.get('recentWinners');

      // Only fetch from contract if not cached
      const contractCalls = [];
      if (!contractBalance) contractCalls.push(['contractBalance', () => adapter.getContractBalance()]);
      if (!houseFunds) contractCalls.push(['houseFunds', () => adapter.getHouseFunds()]);
      if (!shotCost) contractCalls.push(['shotCost', () => adapter.getShotCost()]);
      if (!sponsorCost) contractCalls.push(['sponsorCost', () => adapter.getSponsorCost()]);
      if (!currentSponsor) contractCalls.push(['currentSponsor', () => adapter.getCurrentSponsor()]);
      if (!recentWinners) contractCalls.push(['recentWinners', () => adapter.getRecentWinners()]);

      // Execute calls sequentially
      for (const [key, call] of contractCalls) {
        try {
          const result = await retryWithBackoff(call, 2, 2000);
          rpcCache.set(key, result);
          
          if (key === 'contractBalance') contractBalance = result;
          else if (key === 'houseFunds') houseFunds = result;
          else if (key === 'shotCost') shotCost = result;
          else if (key === 'sponsorCost') sponsorCost = result;
          else if (key === 'currentSponsor') currentSponsor = result;
          else if (key === 'recentWinners') recentWinners = result;
          
          // Add delay between calls
          if (contractCalls.indexOf([key, call]) < contractCalls.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error) {
          console.warn(`Failed to fetch ${key}, using cached or default value:`, error.message);
          // Use defaults for failed calls
          if (key === 'contractBalance') contractBalance = contractBalance || '0';
          else if (key === 'houseFunds') houseFunds = houseFunds || '0';
          else if (key === 'shotCost') shotCost = shotCost || '0';
          else if (key === 'sponsorCost') sponsorCost = sponsorCost || '0';
          else if (key === 'currentSponsor') currentSponsor = currentSponsor || { active: false };
          else if (key === 'recentWinners') recentWinners = recentWinners || [];
        }
      }

      // Calculate actual pot using adapter
      const actualPot = await adapter.getCurrentPot();
      
      // Update state with contract values
      updateState(currentState => ({
        ...currentState,
        currentPot: actualPot || '0',
        shotCost: shotCost || '0',
        sponsorCost: sponsorCost || '0',
      }));

      // Update USD values for multi-crypto mode
      const currentStateForUSD = { ...state, currentPot: actualPot || '0', shotCost: shotCost || '0', sponsorCost: sponsorCost || '0' };
      const updatedStateWithUSD = await updateUSDValues(currentStateForUSD);
      
      updateState(currentState => ({
        ...currentState,
        currentPotUSD: updatedStateWithUSD.currentPotUSD,
        shotCostUSD: updatedStateWithUSD.shotCostUSD,
        sponsorCostUSD: updatedStateWithUSD.sponsorCostUSD,
      }));

    } else {
      // ETH-only mode: direct contract calls
      if (!contract || !ethers) return;

      // Check cache first
      contractBalance = rpcCache.get('contractBalance');
      houseFunds = rpcCache.get('houseFunds');
      shotCost = rpcCache.get('shotCost');
      sponsorCost = rpcCache.get('sponsorCost');
      currentSponsor = rpcCache.get('currentSponsor');
      recentWinners = rpcCache.get('recentWinners');

      // Only fetch from contract if not cached
      const contractCalls = [];
      if (!contractBalance) contractCalls.push(['contractBalance', () => contract.getContractBalance()]);
      if (!houseFunds) contractCalls.push(['houseFunds', () => contract.getHouseFunds()]);
      if (!shotCost) contractCalls.push(['shotCost', () => contract.SHOT_COST()]);
      if (!sponsorCost) contractCalls.push(['sponsorCost', () => contract.SPONSOR_COST()]);
      if (!currentSponsor) contractCalls.push(['currentSponsor', () => contract.getCurrentSponsor()]);
      if (!recentWinners) contractCalls.push(['recentWinners', () => contract.getRecentWinners()]);

      // Execute calls sequentially
      for (const [key, call] of contractCalls) {
        try {
          const result = await retryWithBackoff(call, 2, 2000);
          rpcCache.set(key, result);
          
          if (key === 'contractBalance') contractBalance = result;
          else if (key === 'houseFunds') houseFunds = result;
          else if (key === 'shotCost') shotCost = result;
          else if (key === 'sponsorCost') sponsorCost = result;
          else if (key === 'currentSponsor') currentSponsor = result;
          else if (key === 'recentWinners') recentWinners = result;
          
          // Add delay between calls
          if (contractCalls.indexOf([key, call]) < contractCalls.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error) {
          console.warn(`Failed to fetch ${key}, using cached or default value:`, error.message);
          // Use defaults for failed calls
          if (key === 'contractBalance') contractBalance = contractBalance || '0';
          else if (key === 'houseFunds') houseFunds = houseFunds || '0';
          else if (key === 'shotCost') shotCost = shotCost || ethers.parseEther('0.001');
          else if (key === 'sponsorCost') sponsorCost = sponsorCost || ethers.parseEther('0.001');
          else if (key === 'currentSponsor') currentSponsor = currentSponsor || { active: false };
          else if (key === 'recentWinners') recentWinners = recentWinners || [];
        }
      }

      // Calculate actual pot (contract balance minus house funds)
      // Ensure pot never goes negative
      const rawPot = contractBalance && houseFunds ?
        BigInt(contractBalance) - BigInt(houseFunds) :
        BigInt(contractBalance || '0');
      const actualPot = rawPot < 0n ? 0n : rawPot;
      
      // Log for debugging if pot calculation seems off
      if (rawPot < 0n) {
        console.warn('⚠️ Pot calculation resulted in negative value:', {
          contractBalance: contractBalance?.toString(),
          houseFunds: houseFunds?.toString(),
          rawPot: rawPot.toString(),
          adjustedPot: actualPot.toString()
        });
      }
        
      // Force fresh contract calls if pot seems wrong
      if (ethers.formatEther(actualPot) === '0.001') {
        console.log('🚨 Pot is 0.001 ETH - forcing fresh contract calls to verify');
        try {
          const freshContractBalance = await contract.getContractBalance();
          const freshHouseFunds = await contract.getHouseFunds();
          
          // Use fresh data if different
          if (freshContractBalance.toString() !== contractBalance?.toString() ||
              freshHouseFunds.toString() !== houseFunds?.toString()) {
            console.log('📊 Using fresh data instead of cached data');
            contractBalance = freshContractBalance;
            houseFunds = freshHouseFunds;
            
            // Update cache with fresh data
            rpcCache.set('contractBalance', contractBalance);
            rpcCache.set('houseFunds', houseFunds);
          }
        } catch (freshError) {
          console.error('❌ Failed to fetch fresh contract data:', freshError);
        }
      }

      const newPotAmount = ethers.formatEther(actualPot);
      const previousPot = state.currentPot;
      
      // Check for pot milestones
      checkPotMilestones(previousPot, newPotAmount, notifyPotMilestone);

      // Update state with contract values
      updateState(currentState => ({
        ...currentState,
        currentPot: newPotAmount,
        shotCost: ethers.formatEther(shotCost || ethers.parseEther('0.001')),
        sponsorCost: ethers.formatEther(sponsorCost || ethers.parseEther('0.001')),
      }));

      // Update USD values for ETH-only mode
      const currentStateForUSD = {
        ...state,
        currentPot: newPotAmount,
        shotCost: ethers.formatEther(shotCost || ethers.parseEther('0.001')),
        sponsorCost: ethers.formatEther(sponsorCost || ethers.parseEther('0.001')),
      };
      const updatedStateWithUSD = await updateUSDValues(currentStateForUSD);
      
      updateState(currentState => ({
        ...currentState,
        currentPotUSD: updatedStateWithUSD.currentPotUSD,
        shotCostUSD: updatedStateWithUSD.shotCostUSD,
        sponsorCostUSD: updatedStateWithUSD.sponsorCostUSD,
      }));
    }

    // Load database data (common for both modes)
    const [dbWinners, dbStats, dbSponsors, topPlayers] = await Promise.all([
      db.getRecentWinners(10),
      db.getGameStats(),
      db.getCurrentSponsor(),
      db.getTopPlayers(10)
    ]);

    // Use database data when available, fallback to contract data
    const winners = dbWinners.length > 0 ? dbWinners : (recentWinners || []).map(winner => ({
      ...winner,
      amount: state.isMultiCryptoMode ? winner.amount : ethers.formatEther(winner.amount),
      timestamp: new Date(safeBigIntToNumber(winner.timestamp) * 1000).toISOString()
    }));

    const sponsor = dbSponsors || (currentSponsor?.active ? currentSponsor : null);

    updateState(currentState => ({
      ...currentState,
      currentSponsor: sponsor,
      recentWinners: winners,
      topPlayers: topPlayers || [],
      lastUpdate: new Date().toISOString()
    }));

  } catch (error) {
    console.error('Failed to load game state:', error);
    updateState(currentState => ({ ...currentState, error: error.message }));
  }
};

/**
 * Initialize contract for ETH-only mode
 * @param {Object} params - Parameters object
 * @param {Function} params.updateState - State update function
 * @returns {Promise<Object>} Contract instance and ethers library
 */
export const initializeEthContract = async ({ updateState }) => {
  const contractAddress = NETWORK_CONFIG.CONTRACT_ADDRESS;
  const validation = validateContractDeployment(contractAddress);
  
  if (!validation.isValid) {
    updateState(state => ({
      ...state,
      contractAddress: contractAddress || 'Not configured',
      contractDeployed: false,
      loading: false,
      error: validation.error
    }));
    return { contract: null, ethers: null };
  }

  updateState(state => ({
    ...state,
    contractAddress,
  }));

  // Dynamic import for browser-only ethers library
  const ethersModule = await import('ethers');
  const ethers = ethersModule;

  // Create contract instance with read-only provider and retry logic
  const provider = await createProviderWithRetry(ethers, NETWORK_CONFIG, retryWithBackoff);
  const contract = new ethers.Contract(contractAddress, ETH_SHOT_ABI, provider);
  
  // Check if contract is actually deployed by trying to call a view function
  try {
    await retryWithBackoff(() => contract.SHOT_COST(), 3, 1000);
    
    updateState(state => ({
      ...state,
      contractDeployed: true,
      contract
    }));
    
    return { contract, ethers };
    
  } catch (contractError) {
    console.error('Contract not deployed or not accessible:', contractError);
    
    const errorMessage = handleContractError(contractError, 'ETH');
    
    updateState(state => ({
      ...state,
      contractDeployed: false,
      loading: false,
      error: errorMessage
    }));
    
    return { contract: null, ethers: null };
  }
};

/**
 * Initialize adapter for multi-crypto mode
 * @param {string} cryptoType - The cryptocurrency type
 * @param {Function} updateState - State update function
 * @returns {Promise<boolean>} Success status
 */
export const initializeMultiCryptoAdapter = async (cryptoType, updateState) => {
  const adapter = getActiveAdapter();
  if (!adapter) {
    throw new Error(`No adapter found for ${cryptoType}. Please initialize wallet first.`);
  }

  // Check if contract/program is deployed
  try {
    await adapter.getShotCost(); // Test call to verify deployment
    
    updateState(state => ({
      ...state,
      contractDeployed: true,
      contractAddress: adapter.config.contractConfig.address || 'N/A'
    }));
    
    return true;
    
  } catch (contractError) {
    console.error('Contract/Program not deployed or not accessible:', contractError);
    
    const errorMessage = handleContractError(contractError, cryptoType);
    
    updateState(state => ({
      ...state,
      contractDeployed: false,
      loading: false,
      error: errorMessage
    }));
    
    return false;
  }
};