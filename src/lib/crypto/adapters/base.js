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
   * Take a shot at the jackpot
   * @returns {Promise<{hash: string, receipt: Object, won: boolean}>}
   */
  async takeShot() {
    throw new Error('takeShot() must be implemented by crypto adapter');
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