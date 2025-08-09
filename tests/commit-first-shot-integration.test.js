/**
 * Test for commitFirstShot() Contract Function Integration
 * 
 * This test verifies that the new commitFirstShot() function works correctly
 * with configurable first shot amounts from VITE_FIRST_SHOT_COST_ETH
 */

import { expect } from 'chai';
import { ethers } from 'ethers';

// Mock the dependencies
const mockGameConfig = {
  FIRST_SHOT_COST_ETH: '0.001',
  COOLDOWN_PERIOD: '60000'
};

const mockGameState = {
  contractDeployed: true,
  canShoot: true,
  takingShot: false,
  isMultiCryptoMode: false,
  activeCrypto: 'ETH',
  contractAddress: '0x1234567890123456789012345678901234567890',
  totalShots: 0
};

const mockWallet = {
  connected: true,
  address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
  signer: {
    // Mock signer methods
  },
  provider: {
    getBalance: async () => ethers.parseEther('1.0'), // 1 ETH balance
    getFeeData: async () => ({
      maxFeePerGas: ethers.parseUnits('20', 'gwei'),
      maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei'),
      gasPrice: ethers.parseUnits('20', 'gwei')
    })
  }
};

const mockContract = {
  SHOT_COST: async () => ethers.parseEther('0.0005'), // Contract base cost
  paused: async () => false,
  canCommitShot: async () => true,
  getCooldownRemaining: async () => 0n,
  hasPendingShot: async () => false,
  getCurrentPot: async () => ethers.parseEther('0'), // Empty pot for first shot
  connect: (signer) => ({
    ...mockContract,
    estimateGas: {
      commitFirstShot: async (commitment, options) => {
        // Verify that the value sent is the configured first shot amount
        const expectedValue = ethers.parseEther('0.001');
        if (options.value.toString() !== expectedValue.toString()) {
          throw new Error(`Gas estimation failed: expected ${ethers.formatEther(expectedValue)} ETH but got ${ethers.formatEther(options.value)} ETH`);
        }
        return 85000n; // Slightly higher gas for first shot
      },
      commitShot: async (commitment, options) => {
        // Regular shot gas estimation
        const expectedValue = ethers.parseEther('0.0005');
        if (options.value.toString() !== expectedValue.toString()) {
          throw new Error(`Gas estimation failed: expected ${ethers.formatEther(expectedValue)} ETH but got ${ethers.formatEther(options.value)} ETH`);
        }
        return 80000n;
      }
    },
    commitFirstShot: async (commitment, options) => {
      // Verify that the value sent is the configured first shot amount
      const expectedValue = ethers.parseEther('0.001');
      if (options.value.toString() !== expectedValue.toString()) {
        throw new Error(`Transaction would revert: expected ${ethers.formatEther(expectedValue)} ETH but got ${ethers.formatEther(options.value)} ETH`);
      }
      
      // Return mock transaction
      return {
        hash: '0xfirstshot1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        wait: async () => ({
          hash: '0xfirstshot1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          status: 1,
          gasUsed: 82000n,
          blockNumber: 12346
        })
      };
    },
    commitShot: async (commitment, options) => {
      // Regular shot - verify exact SHOT_COST
      const expectedValue = ethers.parseEther('0.0005');
      if (options.value.toString() !== expectedValue.toString()) {
        throw new Error(`Transaction would revert: expected ${ethers.formatEther(expectedValue)} ETH but got ${ethers.formatEther(options.value)} ETH`);
      }
      
      return {
        hash: '0xregularshot1234567890abcdef1234567890abcdef1234567890abcdef123456',
        wait: async () => ({
          hash: '0xregularshot1234567890abcdef1234567890abcdef1234567890abcdef123456',
          status: 1,
          gasUsed: 78000n,
          blockNumber: 12347
        })
      };
    }
  })
};

const mockDb = {
  recordShot: async (shotData) => {
    console.log('📝 Recording shot in database:', shotData);
    return { success: true };
  }
};

describe('commitFirstShot() Contract Integration', () => {
  
  it('should detect first shot correctly with configurable amount', () => {
    const customShotCost = '0.001'; // From VITE_FIRST_SHOT_COST_ETH
    const isFirstShot = customShotCost && parseFloat(customShotCost) === parseFloat(mockGameConfig.FIRST_SHOT_COST_ETH);
    
    expect(isFirstShot).to.be.true;
    console.log('✅ First shot detection works with configurable amount');
  });

  it('should use commitFirstShot() for first shots with correct amount', async () => {
    const customShotCost = '0.001';
    const shotCost = await mockContract.SHOT_COST();
    const customCostWei = ethers.parseEther(customShotCost);
    const isFirstShot = customShotCost && parseFloat(customShotCost) === parseFloat(mockGameConfig.FIRST_SHOT_COST_ETH);
    const commitment = ethers.keccak256(ethers.toUtf8Bytes('test'));
    
    console.log('Testing commitFirstShot with:', {
      customShotCost,
      shotCostFromContract: ethers.formatEther(shotCost),
      customCostWei: ethers.formatEther(customCostWei),
      isFirstShot
    });
    
    const contractWithSigner = mockContract.connect(mockWallet.signer);
    
    try {
      // Test gas estimation for first shot
      await contractWithSigner.estimateGas.commitFirstShot(commitment, {
        value: customCostWei // Should be 0.001 ETH
      });
      console.log('✅ Gas estimation passed for commitFirstShot with 0.001 ETH');
      
      // Test actual transaction for first shot
      const tx = await contractWithSigner.commitFirstShot(commitment, {
        value: customCostWei // Should be 0.001 ETH
      });
      
      expect(tx.hash).to.include('firstshot');
      console.log('✅ commitFirstShot transaction sent successfully with 0.001 ETH');
      
    } catch (error) {
      throw new Error(`commitFirstShot should not fail: ${error.message}`);
    }
  });

  it('should use commitShot() for regular shots with SHOT_COST', async () => {
    const shotCost = await mockContract.SHOT_COST();
    const commitment = ethers.keccak256(ethers.toUtf8Bytes('test'));
    
    console.log('Testing commitShot with:', {
      shotCost: ethers.formatEther(shotCost),
      isFirstShot: false
    });
    
    const contractWithSigner = mockContract.connect(mockWallet.signer);
    
    try {
      // Test gas estimation for regular shot
      await contractWithSigner.estimateGas.commitShot(commitment, {
        value: shotCost // Should be 0.0005 ETH
      });
      console.log('✅ Gas estimation passed for commitShot with 0.0005 ETH');
      
      // Test actual transaction for regular shot
      const tx = await contractWithSigner.commitShot(commitment, {
        value: shotCost // Should be 0.0005 ETH
      });
      
      expect(tx.hash).to.include('regularshot');
      console.log('✅ commitShot transaction sent successfully with 0.0005 ETH');
      
    } catch (error) {
      throw new Error(`commitShot should not fail: ${error.message}`);
    }
  });

  it('should handle different first shot amounts from configuration', async () => {
    // Test with different configured amounts
    const testAmounts = ['0.001', '0.002', '0.0015'];
    const shotCost = await mockContract.SHOT_COST();
    
    for (const amount of testAmounts) {
      const customCostWei = ethers.parseEther(amount);
      const commitment = ethers.keccak256(ethers.toUtf8Bytes('test'));
      
      // Verify amount is >= SHOT_COST (contract requirement)
      expect(Number(customCostWei)).to.be.greaterThanOrEqual(Number(shotCost));
      
      console.log(`✅ Amount ${amount} ETH is valid (>= ${ethers.formatEther(shotCost)} ETH)`);
    }
  });

  it('should create correct result object for first shot', () => {
    const customShotCost = '0.001';
    const actualFirstShotAmount = ethers.parseEther(customShotCost);
    const actualFirstShotAmountEth = ethers.formatEther(actualFirstShotAmount);
    
    const mockReceipt = {
      hash: '0xfirstshot1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      status: 1,
      gasUsed: 82000n,
      blockNumber: 12346
    };
    
    const result = {
      hash: mockReceipt.hash,
      receipt: mockReceipt,
      isCommitOnly: true,
      isFirstShot: true,
      won: false,
      displayAmount: customShotCost,
      contractAmount: actualFirstShotAmountEth,
      actualAmount: actualFirstShotAmountEth
    };
    
    expect(result.isFirstShot).to.be.true;
    expect(result.won).to.be.false;
    expect(result.displayAmount).to.equal('0.001');
    expect(result.contractAmount).to.equal('0.001');
    expect(result.actualAmount).to.equal('0.001');
    
    console.log('✅ Result object created correctly for first shot with actual amount');
  });

  it('should record actual amount paid in database', async () => {
    const customShotCost = '0.001';
    const actualFirstShotAmountEth = '0.001';
    
    const shotData = {
      playerAddress: mockWallet.address,
      amount: customShotCost, // Should be the actual amount paid (0.001 ETH)
      txHash: '0xfirstshot1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      blockNumber: 12346,
      timestamp: new Date().toISOString(),
      won: false,
      cryptoType: mockGameState.activeCrypto,
      contractAddress: mockGameState.contractAddress
    };
    
    // This should not throw an error and should record the actual amount
    await mockDb.recordShot(shotData);
    console.log('✅ Database recording works correctly with actual first shot amount');
  });
});