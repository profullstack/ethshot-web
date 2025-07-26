// Base cryptocurrency adapter interface
// Defines the common interface that all crypto adapters must implement

/**
 * Base cryptocurrency adapter class
 * All crypto-specific adapters should extend this class
 */
export class BaseCryptoAdapter {
  constructor(config) {
    this.config = config;
    this.provider = null;
    this.signer = null;
    this.connected = false;
  }

  /**
   * Initialize the adapter with necessary libraries
   * @returns {Promise<void>}
   */
  async init() {
    throw new Error('init() must be implemented by crypto adapter');
  }

  /**
   * Connect to a wallet
   * @param {string} walletType - Type of wallet to connect to
   * @returns {Promise<{address: string, chainId?: number}>}
   */
  async connect(walletType) {
    throw new Error('connect() must be implemented by crypto adapter');
  }

  /**
   * Disconnect from wallet
   * @returns {Promise<void>}
   */
  async disconnect() {
    throw new Error('disconnect() must be implemented by crypto adapter');
  }

  /**
   * Get wallet balance
   * @param {string} address - Wallet address
   * @returns {Promise<string>} Balance in native currency units
   */
  async getBalance(address) {
    throw new Error('getBalance() must be implemented by crypto adapter');
  }

  /**
   * Switch to a different network
   * @param {string} networkName - Name of network to switch to
   * @returns {Promise<void>}
   */
  async switchNetwork(networkName) {
    throw new Error('switchNetwork() must be implemented by crypto adapter');
  }

  /**
   * Add a new network to wallet
   * @param {string} networkName - Name of network to add
   * @returns {Promise<void>}
   */
  async addNetwork(networkName) {
    throw new Error('addNetwork() must be implemented by crypto adapter');
  }

  /**
   * Get contract instance
   * @returns {Object} Contract instance
   */
  getContract() {
    throw new Error('getContract() must be implemented by crypto adapter');
  }

  /**
   * Generate a cryptographically secure secret for commit-reveal
   * @returns {string} Hex-encoded secret
   */
  generateSecret() {
    throw new Error('generateSecret() must be implemented by crypto adapter');
  }

  /**
   * Generate commitment hash from secret and player address
   * @param {string} secret - The secret value
   * @param {string} playerAddress - Player's wallet address
   * @returns {string} Commitment hash
   */
  generateCommitment(secret, playerAddress) {
    throw new Error('generateCommitment() must be implemented by crypto adapter');
  }

  /**
   * Commit a shot with generated commitment
   * @param {string} commitment - The commitment hash
   * @param {string} shotCost - Optional shot cost (uses default if not provided)
   * @returns {Promise<{hash: string, receipt: Object, committed: boolean, commitBlock: number}>}
   */
  async commitShot(commitment, shotCost = null) {
    throw new Error('commitShot() must be implemented by crypto adapter');
  }

  /**
   * Reveal a committed shot
   * @param {string} secret - The secret used for commitment
   * @returns {Promise<{hash: string, receipt: Object, won: boolean, randomNumber: string, jackpotAmount: string}>}
   */
  async revealShot(secret) {
    throw new Error('revealShot() must be implemented by crypto adapter');
  }

  /**
   * Claim failed payout
   * @returns {Promise<{hash: string, receipt: Object, claimedAmount: string}>}
   */
  async claimPayout() {
    throw new Error('claimPayout() must be implemented by crypto adapter');
  }

  /**
   * Sponsor a round
   * @param {string} name - Sponsor name
   * @param {string} logoUrl - Sponsor logo URL
   * @returns {Promise<{hash: string, receipt: Object}>}
   */
  async sponsorRound(name, logoUrl) {
    throw new Error('sponsorRound() must be implemented by crypto adapter');
  }

  /**
   * Get current pot size
   * @returns {Promise<string>} Pot size in native currency units
   */
  async getCurrentPot() {
    throw new Error('getCurrentPot() must be implemented by crypto adapter');
  }

  /**
   * Get player statistics
   * @param {string} address - Player address
   * @returns {Promise<Object>} Player stats object
   */
  async getPlayerStats(address) {
    throw new Error('getPlayerStats() must be implemented by crypto adapter');
  }

  /**
   * Check if player can take a shot
   * @param {string} address - Player address
   * @returns {Promise<boolean>}
   */
  async canTakeShot(address) {
    throw new Error('canTakeShot() must be implemented by crypto adapter');
  }

  /**
   * Get cooldown remaining for player
   * @param {string} address - Player address
   * @returns {Promise<number>} Seconds remaining
   */
  async getCooldownRemaining(address) {
    throw new Error('getCooldownRemaining() must be implemented by crypto adapter');
  }

  /**
   * Get current sponsor information
   * @returns {Promise<Object>} Sponsor info object
   */
  async getCurrentSponsor() {
    throw new Error('getCurrentSponsor() must be implemented by crypto adapter');
  }

  /**
   * Get recent winners
   * @returns {Promise<Array>} Array of recent winners
   */
  async getRecentWinners() {
    throw new Error('getRecentWinners() must be implemented by crypto adapter');
  }

  /**
   * Get shot cost
   * @returns {Promise<string>} Shot cost in native currency units
   */
  async getShotCost() {
    throw new Error('getShotCost() must be implemented by crypto adapter');
  }

  /**
   * Get sponsor cost
   * @returns {Promise<string>} Sponsor cost in native currency units
   */
  async getSponsorCost() {
    throw new Error('getSponsorCost() must be implemented by crypto adapter');
  }

  /**
   * Generate a cryptographically secure secret for commit-reveal
   * @returns {string} Hex-encoded secret
   */
  generateSecret() {
    throw new Error('generateSecret() must be implemented by crypto adapter');
  }

  /**
   * Generate commitment hash from secret and player address
   * @param {string} secret - The secret value
   * @param {string} playerAddress - Player's address
   * @returns {string} Commitment hash
   */
  generateCommitment(secret, playerAddress) {
    throw new Error('generateCommitment() must be implemented by crypto adapter');
  }

  /**
   * Commit a shot with generated commitment
   * @param {string} commitment - Commitment hash
   * @param {string} shotCost - Optional shot cost override
   * @returns {Promise<{hash: string, receipt: Object, committed: boolean, commitBlock: number}>}
   */
  async commitShot(commitment, shotCost = null) {
    throw new Error('commitShot() must be implemented by crypto adapter');
  }

  /**
   * Reveal a committed shot
   * @param {string} secret - The secret used in commitment
   * @returns {Promise<{hash: string, receipt: Object, won: boolean, randomNumber: string, jackpotAmount: string}>}
   */
  async revealShot(secret) {
    throw new Error('revealShot() must be implemented by crypto adapter');
  }

  /**
   * Check if player can reveal their shot
   * @param {string} address - Player address
   * @returns {Promise<boolean>}
   */
  async canRevealShot(address) {
    throw new Error('canRevealShot() must be implemented by crypto adapter');
  }

  /**
   * Check if player has a pending shot
   * @param {string} address - Player address
   * @returns {Promise<boolean>}
   */
  async hasPendingShot(address) {
    throw new Error('hasPendingShot() must be implemented by crypto adapter');
  }

  /**
   * Get pending shot details for player
   * @param {string} address - Player address
   * @returns {Promise<{exists: boolean, blockNumber: number, amount: string}>}
   */
  async getPendingShot(address) {
    throw new Error('getPendingShot() must be implemented by crypto adapter');
  }

  /**
   * Get pending payout amount for player
   * @param {string} address - Player address
   * @returns {Promise<string>} Pending payout amount
   */
  async getPendingPayout(address) {
    throw new Error('getPendingPayout() must be implemented by crypto adapter');
  }

  /**
   * Get contract balance
   * @returns {Promise<string>} Contract balance in native currency units
   */
  async getContractBalance() {
    throw new Error('getContractBalance() must be implemented by crypto adapter');
  }

  /**
   * Get house funds
   * @returns {Promise<string>} House funds in native currency units
   */
  async getHouseFunds() {
    throw new Error('getHouseFunds() must be implemented by crypto adapter');
  }

  /**
   * Get game configuration in basis points
   * @returns {Promise<{winPercentageBP: number, housePercentageBP: number, winChanceBP: number}>}
   */
  async getGameConfig() {
    throw new Error('getGameConfig() must be implemented by crypto adapter');
  }

  /**
   * Get cooldown period from contract
   * @returns {Promise<number>} Cooldown period in seconds
   */
  async getCooldownPeriod() {
    throw new Error('getCooldownPeriod() must be implemented by crypto adapter');
  }

  /**
   * Get win percentage in basis points
   * @returns {Promise<number>} Win percentage in basis points
   */
  async getWinPercentageBP() {
    throw new Error('getWinPercentageBP() must be implemented by crypto adapter');
  }

  /**
   * Get house percentage in basis points
   * @returns {Promise<number>} House percentage in basis points
   */
  async getHousePercentageBP() {
    throw new Error('getHousePercentageBP() must be implemented by crypto adapter');
  }

  /**
   * Get win chance in basis points
   * @returns {Promise<number>} Win chance in basis points
   */
  async getWinChanceBP() {
    throw new Error('getWinChanceBP() must be implemented by crypto adapter');
  }

  /**
   * Get maximum recent winners limit
   * @returns {Promise<number>} Maximum recent winners
   */
  async getMaxRecentWinners() {
    throw new Error('getMaxRecentWinners() must be implemented by crypto adapter');
  }

  /**
   * Get minimum pot size
   * @returns {Promise<string>} Minimum pot size in native currency units
   */
  async getMinPotSize() {
    throw new Error('getMinPotSize() must be implemented by crypto adapter');
  }

  /**
   * Withdraw house funds (owner only)
   * @returns {Promise<{hash: string, receipt: Object, withdrawnAmount: string}>}
   */
  async withdrawHouseFunds() {
    throw new Error('withdrawHouseFunds() must be implemented by crypto adapter');
  }

  /**
   * Pause the contract (owner only)
   * @returns {Promise<{hash: string, receipt: Object}>}
   */
  async pauseContract() {
    throw new Error('pauseContract() must be implemented by crypto adapter');
  }

  /**
   * Unpause the contract (owner only)
   * @returns {Promise<{hash: string, receipt: Object}>}
   */
  async unpauseContract() {
    throw new Error('unpauseContract() must be implemented by crypto adapter');
  }

  /**
   * Set test mode (owner only)
   * @param {boolean} enabled - Whether to enable test mode
   * @returns {Promise<{hash: string, receipt: Object, testMode: boolean}>}
   */
  async setTestMode(enabled) {
    throw new Error('setTestMode() must be implemented by crypto adapter');
  }

  /**
   * Set winning number for test mode (owner only)
   * @param {number} winningNumber - The winning number to set
   * @returns {Promise<{hash: string, receipt: Object, winningNumber: number}>}
   */
  async setWinningNumber(winningNumber) {
    throw new Error('setWinningNumber() must be implemented by crypto adapter');
  }

  /**
   * Format amount for display
   * @param {string|number} amount - Amount to format
   * @param {number} precision - Decimal precision
   * @returns {string} Formatted amount
   */
  formatAmount(amount, precision = 4) {
    return this.config.formatters.formatAmount(amount, precision);
  }

  /**
   * Format address for display
   * @param {string} address - Address to format
   * @returns {string} Formatted address
   */
  formatAddress(address) {
    return this.config.formatters.formatAddress(address);
  }

  /**
   * Parse amount from string to native units
   * @param {string} amount - Amount string
   * @returns {*} Parsed amount in native units
   */
  parseAmount(amount) {
    return this.config.formatters.parseAmount(amount);
  }

  /**
   * Format units from native to display units
   * @param {*} amount - Amount in native units
   * @returns {string} Formatted amount string
   */
  formatUnits(amount) {
    return this.config.formatters.formatUnits(amount);
  }

  /**
   * Validate address format
   * @param {string} address - Address to validate
   * @returns {boolean} True if valid
   */
  isValidAddress(address) {
    return this.config.validators.isValidAddress(address);
  }

  /**
   * Validate amount format
   * @param {string|number} amount - Amount to validate
   * @returns {boolean} True if valid
   */
  isValidAmount(amount) {
    return this.config.validators.isValidAmount(amount);
  }

  /**
   * Setup event listeners for wallet events
   * @param {Object} walletInstance - Wallet instance
   * @param {Function} onAccountsChanged - Callback for account changes
   * @param {Function} onChainChanged - Callback for chain changes
   * @param {Function} onDisconnect - Callback for disconnect
   */
  setupEventListeners(walletInstance, onAccountsChanged, onChainChanged, onDisconnect) {
    // Default implementation - can be overridden by specific adapters
    if (walletInstance?.on) {
      walletInstance.on('accountsChanged', onAccountsChanged);
      walletInstance.on('chainChanged', onChainChanged);
      walletInstance.on('disconnect', onDisconnect);
    }
  }

  /**
   * Get network configuration by name
   * @param {string} networkName - Network name
   * @returns {Object} Network configuration
   */
  getNetworkConfig(networkName) {
    const network = this.config.networks[networkName];
    if (!network) {
      throw new Error(`Network ${networkName} not found in ${this.config.type} configuration`);
    }
    return network;
  }

  /**
   * Get current network configuration
   * @returns {Object} Current network configuration
   */
  getCurrentNetworkConfig() {
    return this.getNetworkConfig(this.config.defaultNetwork);
  }

  /**
   * Check if wallet provider is supported
   * @param {string} walletType - Wallet type to check
   * @returns {boolean} True if supported
   */
  isWalletSupported(walletType) {
    return this.config.walletProviders.includes(walletType);
  }
}