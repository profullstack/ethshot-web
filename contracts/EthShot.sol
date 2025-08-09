// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title EthShot
 * @dev A viral, pay-to-play, Ethereum-powered game where users take a chance to win an ETH jackpot
 * @author ETH Shot Team
 * @notice This contract uses commit-reveal scheme for secure on-chain randomness
 */
contract EthShot is Ownable, Pausable, ReentrancyGuard {
    // Configurable parameters (set in constructor)
    uint256 public immutable SHOT_COST;
    uint256 public immutable SPONSOR_COST;
    uint256 public immutable COOLDOWN_PERIOD;
    uint256 public immutable WIN_PERCENTAGE_BP; // Basis points (10000 = 100%)
    uint256 public immutable HOUSE_PERCENTAGE_BP; // Basis points
    uint256 public immutable WIN_CHANCE_BP; // Basis points
    uint256 public immutable MAX_RECENT_WINNERS;
    uint256 public immutable MIN_POT_SIZE;
    address public immutable HOUSE_ADDRESS; // Address to receive house funds
    
    // Commit-reveal scheme variables
    uint256 private constant REVEAL_DELAY = 1; // blocks
    uint256 private constant MAX_REVEAL_DELAY = 256; // blocks (block hash limit)
    
    // Constants
    uint256 private constant BASIS_POINTS = 10000;
    uint256 private constant MAX_COOLDOWN = 24 hours;
    uint256 private constant MAX_SPONSOR_NAME_LENGTH = 50;
    uint256 private constant MAX_SPONSOR_URL_LENGTH = 200;
    
    // State variables
    uint256 private currentPot;
    uint256 private houseFunds;
    
    // Commit-reveal scheme tracking
    struct PendingShot {
        bytes32 commitment;
        uint256 blockNumber;
        uint256 amount;
        bool exists;
    }
    
    mapping(address => PendingShot) private pendingShots;
    mapping(address => uint256) private pendingPayouts; // player => pending payout amount
    
    // Enhanced randomness sources
    uint256 private nonce;
    mapping(address => uint256) private playerNonces;
    
    // Test mode variables (for testing only)
    bool public testMode = false;
    uint256 private testWinningNumber = 0;
    bool public testFiftyPercentMode = false; // 50% win rate for testing payouts
    uint256 private constant TEST_COOLDOWN_PERIOD = 60; // 1 minute cooldown for test mode
    
    // Network detection - mainnet chain ID is 1
    uint256 private constant MAINNET_CHAIN_ID = 1;
    
    // Structs
    struct PlayerStats {
        uint256 totalShots;
        uint256 totalSpent;
        uint256 totalWon;
        uint256 lastShotTime;
    }
    
    struct Winner {
        address winner;
        uint256 amount;
        uint256 timestamp;
        uint256 blockNumber;
    }
    
    struct SponsorInfo {
        address sponsor;
        string name;
        string logoUrl;
        uint256 timestamp;
        bool active;
    }
    
    // Mappings
    mapping(address => PlayerStats) public playerStats;
    mapping(address => uint256) public lastShotTime;
    
    // Arrays
    Winner[] public recentWinners;
    
    // Current sponsor
    SponsorInfo public currentSponsor;
    
    // Events
    event ShotCommitted(address indexed player, bytes32 indexed commitment, uint256 amount);
    event ShotRevealed(address indexed player, uint256 indexed amount, bool indexed won);
    event JackpotWon(address indexed winner, uint256 indexed amount, uint256 indexed timestamp);
    event SponsorshipActivated(address indexed sponsor, string name, string logoUrl);
    event SponsorshipCleared();
    event HouseFundsWithdrawn(address indexed owner, uint256 amount);
    event PayoutFailed(address indexed player, uint256 amount);
    event PayoutClaimed(address indexed player, uint256 amount);
    event PendingShotExpired(address indexed player, uint256 indexed commitBlock, uint256 indexed currentBlock);
    
    // Modifiers
    modifier canCommit(address player) {
        // Use test cooldown if test mode is enabled, otherwise use normal cooldown
        uint256 cooldownToUse = testMode ? TEST_COOLDOWN_PERIOD : COOLDOWN_PERIOD;
        require(
            block.timestamp >= lastShotTime[player] + cooldownToUse,
            "Cooldown period not elapsed"
        );
        
        // Auto-cleanup expired pending shots
        if (pendingShots[player].exists) {
            uint256 commitBlock = pendingShots[player].blockNumber;
            if (block.number > commitBlock + MAX_REVEAL_DELAY) {
                // Pending shot expired, clean it up automatically
                delete pendingShots[player];
                emit PendingShotExpired(player, commitBlock, block.number);
            } else {
                revert("Previous shot still pending");
            }
        }
        
        require(tx.origin == msg.sender, "Must be called directly by EOA");
        _;
    }
    
    modifier canReveal(address player) {
        require(pendingShots[player].exists, "No pending shot to reveal");
        require(
            block.number > pendingShots[player].blockNumber + REVEAL_DELAY,
            "Reveal delay not elapsed"
        );
        require(
            block.number <= pendingShots[player].blockNumber + MAX_REVEAL_DELAY,
            "Reveal window expired"
        );
        _;
    }
    
    modifier correctPayment(uint256 expectedAmount) {
        require(msg.value == expectedAmount, "Incorrect payment amount");
        _;
    }
    
    modifier correctSponsorPayment() {
        require(msg.value == SPONSOR_COST, "Incorrect sponsor payment");
        _;
    }
    
    // FIXED: Create separate modifiers for commit and reveal phases
    modifier validPotSizeForReveal() {
        require(currentPot >= MIN_POT_SIZE, "Pot too small for payout precision");
        _;
    }
    
    constructor(
        address initialOwner,
        address _houseAddress,
        uint256 _shotCost,
        uint256 _sponsorCost,
        uint256 _cooldownPeriod,
        uint256 _winPercentageBP,
        uint256 _housePercentageBP,
        uint256 _winChanceBP,
        uint256 _maxRecentWinners,
        uint256 _minPotSize
    ) Ownable(initialOwner) {
        // Validate parameters
        require(_houseAddress != address(0), "House address cannot be zero");
        require(_shotCost > 0, "Shot cost must be greater than 0");
        require(_sponsorCost > 0, "Sponsor cost must be greater than 0");
        require(_cooldownPeriod > 0 && _cooldownPeriod <= MAX_COOLDOWN, "Invalid cooldown period");
        require(_winPercentageBP > 0 && _winPercentageBP <= BASIS_POINTS, "Invalid win percentage");
        require(_housePercentageBP > 0 && _housePercentageBP <= BASIS_POINTS, "Invalid house percentage");
        require(_winPercentageBP + _housePercentageBP == BASIS_POINTS, "Percentages must sum to 100%");
        require(_winChanceBP > 0 && _winChanceBP <= BASIS_POINTS, "Invalid win chance");
        require(_maxRecentWinners > 0 && _maxRecentWinners <= 1000, "Invalid max recent winners");
        require(_minPotSize >= _shotCost, "Min pot size too small");
        
        // Set immutable parameters
        HOUSE_ADDRESS = _houseAddress;
        SHOT_COST = _shotCost;
        SPONSOR_COST = _sponsorCost;
        COOLDOWN_PERIOD = _cooldownPeriod;
        WIN_PERCENTAGE_BP = _winPercentageBP;
        HOUSE_PERCENTAGE_BP = _housePercentageBP;
        WIN_CHANCE_BP = _winChanceBP;
        MAX_RECENT_WINNERS = _maxRecentWinners;
        MIN_POT_SIZE = _minPotSize;
        
        // Initialize state
        currentPot = 0;
        houseFunds = 0;
        nonce = 0;
    }
    
    /**
     * @dev Commit to taking a shot (step 1 of commit-reveal)
     * @param commitment Hash of (secret + player address)
     * @notice Costs SHOT_COST ETH per shot, uses commit-reveal for randomness
     * @notice FIXED: Removed validPotSize modifier to allow first shots
     */
    function commitShot(bytes32 commitment)
        external
        payable
        whenNotPaused
        nonReentrant
        canCommit(msg.sender)
        correctPayment(SHOT_COST)
        // REMOVED: validPotSize - this was preventing first shots
    {
        require(commitment != bytes32(0), "Invalid commitment");
        
        // Store pending shot
        pendingShots[msg.sender] = PendingShot({
            commitment: commitment,
            blockNumber: block.number,
            amount: SHOT_COST,
            exists: true
        });
        
        // Update player stats
        PlayerStats storage stats = playerStats[msg.sender];
        unchecked {
            stats.totalShots++;
            stats.totalSpent += SHOT_COST;
        }
        lastShotTime[msg.sender] = block.timestamp;
        
        // Add to pot
        unchecked {
            currentPot += SHOT_COST;
        }
        
        emit ShotCommitted(msg.sender, commitment, SHOT_COST);
    }
    
    /**
     * @dev Commit to taking a first shot with configurable amount (step 1 of commit-reveal)
     * @param commitment Hash of (secret + player address)
     * @notice Accepts any amount >= SHOT_COST for first shots when pot is empty
     * @notice This allows frontend to configure first shot cost via VITE_FIRST_SHOT_COST_ETH
     */
    function commitFirstShot(bytes32 commitment)
        external
        payable
        whenNotPaused
        nonReentrant
        canCommit(msg.sender)
    {
        require(commitment != bytes32(0), "Invalid commitment");
        require(msg.value >= SHOT_COST, "Payment too low");
        require(currentPot == 0, "Not a first shot - pot must be empty");
        
        // Store pending shot with actual amount paid
        pendingShots[msg.sender] = PendingShot({
            commitment: commitment,
            blockNumber: block.number,
            amount: msg.value, // Store actual amount paid
            exists: true
        });
        
        // Update player stats with actual amount
        PlayerStats storage stats = playerStats[msg.sender];
        unchecked {
            stats.totalShots++;
            stats.totalSpent += msg.value;
        }
        lastShotTime[msg.sender] = block.timestamp;
        
        // Add full amount to pot
        unchecked {
            currentPot += msg.value;
        }
        
        emit ShotCommitted(msg.sender, commitment, msg.value);
    }
    
    /**
     * @dev Reveal the shot and determine outcome (step 2 of commit-reveal)
     * @param secret The secret used in the commitment
     * @notice FIXED: Prevent first shot from winning when pot only contains their contribution
     */
    function revealShot(uint256 secret)
        external
        whenNotPaused
        nonReentrant
        canReveal(msg.sender)
        validPotSizeForReveal  // MOVED: Pot validation to reveal phase
    {
        PendingShot storage shot = pendingShots[msg.sender];
        
        // Verify commitment
        bytes32 hash = keccak256(abi.encodePacked(secret, msg.sender));
        require(hash == shot.commitment, "Invalid secret");
        
        // CRITICAL FIX: Prevent winning when pot only contains current player's contribution
        // This prevents the first shot from being able to "win" their own money
        bool canWin = currentPot > shot.amount;
        
        // Generate randomness using multiple entropy sources
        bool won = false;
        if (canWin) {
            if (testMode) {
                won = _checkWinTest();
            } else {
                won = _checkWin(secret, shot.blockNumber);
            }
        }
        
        // Clean up pending shot
        delete pendingShots[msg.sender];
        
        emit ShotRevealed(msg.sender, shot.amount, won);
        
        if (won) {
            _handleWin(msg.sender);
        }
    }
    
    /**
     * @dev Sponsor the current round with branding
     * @param name Sponsor name to display
     * @param logoUrl URL to sponsor logo image
     */
    function sponsorRound(string calldata name, string calldata logoUrl)
        external
        payable
        whenNotPaused
        correctSponsorPayment
    {
        require(bytes(name).length > 0, "Sponsor name cannot be empty");
        require(bytes(logoUrl).length > 0, "Logo URL cannot be empty");
        
        // Add sponsor payment to house funds
        houseFunds += SPONSOR_COST;
        
        // Set current sponsor
        currentSponsor = SponsorInfo({
            sponsor: msg.sender,
            name: name,
            logoUrl: logoUrl,
            timestamp: block.timestamp,
            active: true
        });
        
        emit SponsorshipActivated(msg.sender, name, logoUrl);
    }
    
    /**
     * @dev Check if a player can commit a shot (cooldown elapsed and no pending shots)
     * @param player Address to check
     * @return bool True if player can commit a shot
     */
    function canCommitShot(address player) external view returns (bool) {
        uint256 cooldownToUse = testMode ? TEST_COOLDOWN_PERIOD : COOLDOWN_PERIOD;
        return block.timestamp >= lastShotTime[player] + cooldownToUse &&
               !pendingShots[player].exists;
    }
    
    /**
     * @dev Check if a player can reveal their shot
     * @param player Address to check
     * @return bool True if player can reveal
     */
    function canRevealShot(address player) external view returns (bool) {
        if (!pendingShots[player].exists) return false;
        
        uint256 commitBlock = pendingShots[player].blockNumber;
        return block.number > commitBlock + REVEAL_DELAY && 
               block.number <= commitBlock + MAX_REVEAL_DELAY;
    }
    
    /**
     * @dev Get current pot size
     * @return uint256 Current pot in wei
     */
    function getCurrentPot() external view returns (uint256) {
        return currentPot;
    }
    
    /**
     * @dev Get player statistics
     * @param player Address to get stats for
     * @return PlayerStats Struct containing player statistics
     */
    function getPlayerStats(address player) external view returns (PlayerStats memory) {
        return playerStats[player];
    }
    
    /**
     * @dev Get current sponsor information
     * @return SponsorInfo Struct containing current sponsor info
     */
    function getCurrentSponsor() external view returns (SponsorInfo memory) {
        return currentSponsor;
    }
    
    /**
     * @dev Get recent winners (last 10)
     * @return Winner[] Array of recent winners
     */
    function getRecentWinners() external view returns (Winner[] memory) {
        uint256 length = recentWinners.length;
        uint256 returnLength = length > 10 ? 10 : length;
        
        Winner[] memory recent = new Winner[](returnLength);
        
        for (uint256 i = 0; i < returnLength; i++) {
            recent[i] = recentWinners[length - 1 - i];
        }
        
        return recent;
    }
    
    /**
     * @dev Get time remaining for player cooldown
     * @param player Address to check
     * @return uint256 Seconds remaining in cooldown (0 if can shoot)
     */
    function getCooldownRemaining(address player) external view returns (uint256) {
        uint256 cooldownToUse = testMode ? TEST_COOLDOWN_PERIOD : COOLDOWN_PERIOD;
        uint256 nextShotTime = lastShotTime[player] + cooldownToUse;
        if (block.timestamp >= nextShotTime) {
            return 0;
        }
        return nextShotTime - block.timestamp;
    }
    
    /**
     * @dev Withdraw house funds (owner only)
     */
    function withdrawHouseFunds() external onlyOwner nonReentrant {
        uint256 amount = houseFunds;
        require(amount > 0, "No house funds to withdraw");
        
        houseFunds = 0;
        
        (bool success, ) = payable(HOUSE_ADDRESS).call{value: amount}("");
        require(success, "Withdrawal failed");
        
        emit HouseFundsWithdrawn(HOUSE_ADDRESS, amount);
    }
    
    /**
     * @dev Pause the contract (owner only)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause the contract (owner only)
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Claim failed payout (for players whose payout failed)
     */
    function claimPayout() external nonReentrant {
        uint256 amount = pendingPayouts[msg.sender];
        require(amount > 0, "No pending payout");
        
        pendingPayouts[msg.sender] = 0;
        
        (bool success, ) = payable(msg.sender).call{value: amount, gas: 2300}("");
        require(success, "Payout claim failed");
        
        emit PayoutClaimed(msg.sender, amount);
    }
    
    /**
     * @dev Clean up expired pending shot for any player (can be called by anyone)
     * @param player Address of player with expired pending shot
     * @notice This helps clean up expired pending shots to unblock players
     */
    function cleanupExpiredPendingShot(address player) external {
        require(pendingShots[player].exists, "No pending shot to clean up");
        
        uint256 commitBlock = pendingShots[player].blockNumber;
        require(block.number > commitBlock + MAX_REVEAL_DELAY, "Pending shot not yet expired");
        
        // Clean up the expired pending shot
        delete pendingShots[player];
        
        emit PendingShotExpired(player, commitBlock, block.number);
    }
    
    // Test functions (only available in test mode and not on mainnet)
    function setTestMode(bool _testMode) external onlyOwner {
        require(block.chainid != MAINNET_CHAIN_ID, "Test mode not allowed on mainnet");
        testMode = _testMode;
    }
    
    function setWinningNumber(uint256 _winningNumber) external onlyOwner {
        require(testMode, "Test mode not enabled");
        require(block.chainid != MAINNET_CHAIN_ID, "Test mode not allowed on mainnet");
        testWinningNumber = _winningNumber;
    }
    
    function setTestFiftyPercentMode(bool _enabled) external onlyOwner {
        require(testMode, "Test mode not enabled");
        require(block.chainid != MAINNET_CHAIN_ID, "Test mode not allowed on mainnet");
        testFiftyPercentMode = _enabled;
    }
    
    /**
     * @dev Get test mode configuration
     * @return isTestMode Whether test mode is enabled
     * @return isFiftyPercentMode Whether 50% win rate mode is enabled
     * @return currentChainId Current blockchain chain ID
     */
    function getTestModeConfig() external view returns (
        bool isTestMode,
        bool isFiftyPercentMode,
        uint256 currentChainId
    ) {
        return (testMode, testFiftyPercentMode, block.chainid);
    }
    
    /**
     * @dev Generate secure randomness using commit-reveal scheme
     * @param secret Player's secret from reveal
     * @param commitBlock Block number when commitment was made
     * @return bool True if player wins
     */
    function _checkWin(uint256 secret, uint256 commitBlock) private returns (bool) {
        // Increment global nonce for additional entropy
        unchecked {
            nonce++;
            playerNonces[msg.sender]++;
        }
        
        // Use multiple entropy sources:
        // 1. Player's secret (prevents miner manipulation)
        // 2. Future block hash (prevents player prediction)
        // 3. Global nonce (prevents replay attacks)
        // 4. Player nonce (prevents player-specific replay)
        // 5. Player address (prevents cross-player attacks)
        // 6. Current block data (additional entropy)
        
        uint256 revealBlock = commitBlock + REVEAL_DELAY;
        bytes32 futureBlockHash = blockhash(revealBlock);
        
        // If block hash is not available, use current block data
        if (futureBlockHash == bytes32(0)) {
            futureBlockHash = keccak256(abi.encodePacked(
                block.timestamp,
                block.prevrandao,
                block.coinbase
            ));
        }
        
        uint256 randomNumber = uint256(
            keccak256(
                abi.encodePacked(
                    secret,
                    futureBlockHash,
                    nonce,
                    playerNonces[msg.sender],
                    msg.sender,
                    block.timestamp,
                    block.prevrandao
                )
            )
        ) % BASIS_POINTS;
        
        return randomNumber < WIN_CHANCE_BP;
    }
    
    /**
     * @dev Internal function to check win in test mode
     * @return bool True if shot wins
     */
    function _checkWinTest() private returns (bool) {
        if (testFiftyPercentMode) {
            // 50% win rate for testing pot wins and payouts
            // Use simple alternating pattern based on global nonce
            unchecked {
                nonce++;
            }
            return (nonce % 2) == 1;
        } else {
            // Original behavior: controlled by testWinningNumber
            return testWinningNumber == 1;
        }
    }
    
    /**
     * @dev Internal function to handle winning scenario
     * @param winner Address of the winner
     */
    function _handleWin(address winner) private {
        uint256 potAmount = currentPot;
        uint256 winnerAmount = (potAmount * WIN_PERCENTAGE_BP) / BASIS_POINTS;
        uint256 houseAmount = potAmount - winnerAmount;
        
        // Update player stats
        PlayerStats storage stats = playerStats[winner];
        unchecked {
            stats.totalWon += winnerAmount;
        }
        
        // Add to house funds
        unchecked {
            houseFunds += houseAmount;
        }
        
        // Reset pot
        currentPot = 0;
        
        // Clear sponsorship
        if (currentSponsor.active) {
            currentSponsor.active = false;
            emit SponsorshipCleared();
        }
        
        // Record winner with bounded array
        _addWinner(Winner({
            winner: winner,
            amount: winnerAmount,
            timestamp: block.timestamp,
            blockNumber: block.number
        }));
        
        // Send winnings to winner with gas limit and fallback
        (bool success, ) = payable(winner).call{value: winnerAmount, gas: 2300}("");
        if (!success) {
            // Store failed payout for manual claim
            unchecked {
                pendingPayouts[winner] += winnerAmount;
            }
            emit PayoutFailed(winner, winnerAmount);
        }
        
        emit JackpotWon(winner, winnerAmount, block.timestamp);
    }
    
    /**
     * @dev Add winner to bounded array
     * @param newWinner Winner to add
     */
    function _addWinner(Winner memory newWinner) private {
        recentWinners.push(newWinner);
        
        // Keep array bounded
        if (recentWinners.length > MAX_RECENT_WINNERS) {
            // Remove oldest winner
            unchecked {
                for (uint256 i = 0; i < recentWinners.length - 1; i++) {
                    recentWinners[i] = recentWinners[i + 1];
                }
            }
            recentWinners.pop();
        }
    }
    
    /**
     * @dev Get contract balance
     * @return uint256 Contract balance in wei
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    /**
     * @dev Get house funds balance
     * @return uint256 House funds in wei
     */
    function getHouseFunds() external view returns (uint256) {
        return houseFunds;
    }
    
    /**
     * @dev Get pending payout for a player
     * @param player Address to check
     * @return uint256 Pending payout amount
     */
    function getPendingPayout(address player) external view returns (uint256) {
        return pendingPayouts[player];
    }
    
    /**
     * @dev Get pending shot info for a player
     * @param player Address to check
     * @return exists Whether player has a pending shot
     * @return blockNumber Block number when shot was committed
     * @return amount Amount paid for the shot
     */
    function getPendingShot(address player) external view returns (
        bool exists,
        uint256 blockNumber,
        uint256 amount
    ) {
        PendingShot storage shot = pendingShots[player];
        return (shot.exists, shot.blockNumber, shot.amount);
    }
    
    /**
     * @dev Check if player has a pending shot
     * @param player Address to check
     * @return bool True if player has pending shot
     */
    function hasPendingShot(address player) external view returns (bool) {
        return pendingShots[player].exists;
    }
    
    /**
     * @dev Get game configuration in basis points
     * @return winPercentageBP Winner percentage in basis points
     * @return housePercentageBP House percentage in basis points
     * @return winChanceBP Win chance in basis points
     */
    function getGameConfig() external view returns (
        uint256 winPercentageBP,
        uint256 housePercentageBP,
        uint256 winChanceBP
    ) {
        return (WIN_PERCENTAGE_BP, HOUSE_PERCENTAGE_BP, WIN_CHANCE_BP);
    }
    
    /**
     * @dev Fallback function to reject direct ETH transfers
     */
    receive() external payable {
        revert("Direct transfers not allowed");
    }
    
    fallback() external payable {
        revert("Function not found");
    }
}