// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title EthShot
 * @dev A viral, pay-to-play, Ethereum-powered game where users take a chance to win an ETH jackpot
 * @author ETH Shot Team
 */
contract EthShot is Ownable, Pausable, ReentrancyGuard {
    // Configurable parameters (set in constructor)
    uint256 public immutable SHOT_COST;
    uint256 public immutable SPONSOR_COST;
    uint256 public immutable COOLDOWN_PERIOD;
    uint256 public immutable WIN_PERCENTAGE;
    uint256 public immutable HOUSE_PERCENTAGE;
    uint256 public immutable WIN_CHANCE;
    
    // State variables
    uint256 private currentPot;
    uint256 private houseFunds;
    uint256 private nonce;
    
    // Test mode variables (for testing only)
    bool public testMode = false;
    uint256 private testWinningNumber = 0;
    
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
    event ShotTaken(address indexed player, uint256 amount, bool won);
    event JackpotWon(address indexed winner, uint256 amount, uint256 timestamp);
    event SponsorshipActivated(address indexed sponsor, string name, string logoUrl);
    event SponsorshipCleared();
    event HouseFundsWithdrawn(address indexed owner, uint256 amount);
    
    // Modifiers
    modifier canShoot(address player) {
        require(
            block.timestamp >= lastShotTime[player] + COOLDOWN_PERIOD,
            "Cooldown period not elapsed"
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
    
    constructor(
        address initialOwner,
        uint256 _shotCost,
        uint256 _sponsorCost,
        uint256 _cooldownPeriod,
        uint256 _winPercentage,
        uint256 _housePercentage,
        uint256 _winChance
    ) Ownable(initialOwner) {
        // Validate parameters
        require(_shotCost > 0, "Shot cost must be greater than 0");
        require(_sponsorCost > 0, "Sponsor cost must be greater than 0");
        require(_cooldownPeriod > 0, "Cooldown period must be greater than 0");
        require(_winPercentage > 0 && _winPercentage <= 100, "Win percentage must be between 1-100");
        require(_housePercentage > 0 && _housePercentage <= 100, "House percentage must be between 1-100");
        require(_winPercentage + _housePercentage == 100, "Win and house percentages must sum to 100");
        require(_winChance > 0 && _winChance <= 100, "Win chance must be between 1-100");
        
        // Set immutable parameters
        SHOT_COST = _shotCost;
        SPONSOR_COST = _sponsorCost;
        COOLDOWN_PERIOD = _cooldownPeriod;
        WIN_PERCENTAGE = _winPercentage;
        HOUSE_PERCENTAGE = _housePercentage;
        WIN_CHANCE = _winChance;
        
        // Initialize state
        currentPot = 0;
        houseFunds = 0;
        nonce = 0;
    }
    
    /**
     * @dev Take a shot at winning the jackpot
     * @notice Costs 0.001 ETH per shot, 1% chance to win
     */
    function takeShot() 
        external 
        payable 
        whenNotPaused 
        nonReentrant 
        canShoot(msg.sender)
        correctPayment(SHOT_COST)
    {
        // Update player stats
        playerStats[msg.sender].totalShots++;
        playerStats[msg.sender].totalSpent += SHOT_COST;
        lastShotTime[msg.sender] = block.timestamp;
        
        // Add to pot
        currentPot += SHOT_COST;
        
        // Check if player wins
        bool won = _checkWin();
        
        emit ShotTaken(msg.sender, SHOT_COST, won);
        
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
     * @dev Check if a player can take a shot (cooldown elapsed)
     * @param player Address to check
     * @return bool True if player can take a shot
     */
    function canTakeShot(address player) external view returns (bool) {
        return block.timestamp >= lastShotTime[player] + COOLDOWN_PERIOD;
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
        uint256 nextShotTime = lastShotTime[player] + COOLDOWN_PERIOD;
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
        
        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "Withdrawal failed");
        
        emit HouseFundsWithdrawn(owner(), amount);
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
     * @dev Emergency withdrawal of entire contract balance (owner only)
     * @notice Only for emergency situations
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Emergency withdrawal failed");
        
        // Reset state
        currentPot = 0;
        houseFunds = 0;
    }
    
    // Test functions (only available in test mode)
    function setTestMode(bool _testMode) external onlyOwner {
        testMode = _testMode;
    }
    
    function setWinningNumber(uint256 _winningNumber) external onlyOwner {
        require(testMode, "Test mode not enabled");
        testWinningNumber = _winningNumber;
    }
    
    /**
     * @dev Internal function to check if current shot wins
     * @return bool True if shot wins
     */
    function _checkWin() private returns (bool) {
        if (testMode) {
            return testWinningNumber == 1;
        }
        
        // Generate pseudo-random number
        nonce++;
        uint256 randomNumber = uint256(
            keccak256(
                abi.encodePacked(
                    block.timestamp,
                    block.prevrandao,
                    msg.sender,
                    nonce,
                    blockhash(block.number - 1)
                )
            )
        ) % 100;
        
        return randomNumber < WIN_CHANCE;
    }
    
    /**
     * @dev Internal function to handle winning scenario
     * @param winner Address of the winner
     */
    function _handleWin(address winner) private {
        uint256 potAmount = currentPot;
        uint256 winnerAmount = (potAmount * WIN_PERCENTAGE) / 100;
        uint256 houseAmount = potAmount - winnerAmount;
        
        // Update player stats
        playerStats[winner].totalWon += winnerAmount;
        
        // Add to house funds
        houseFunds += houseAmount;
        
        // Reset pot
        currentPot = 0;
        
        // Clear sponsorship
        if (currentSponsor.active) {
            currentSponsor.active = false;
            emit SponsorshipCleared();
        }
        
        // Record winner
        recentWinners.push(Winner({
            winner: winner,
            amount: winnerAmount,
            timestamp: block.timestamp,
            blockNumber: block.number
        }));
        
        // Send winnings to winner
        (bool success, ) = payable(winner).call{value: winnerAmount}("");
        require(success, "Winner payout failed");
        
        emit JackpotWon(winner, winnerAmount, block.timestamp);
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
     * @dev Fallback function to reject direct ETH transfers
     */
    receive() external payable {
        revert("Direct transfers not allowed");
    }
    
    fallback() external payable {
        revert("Function not found");
    }
}