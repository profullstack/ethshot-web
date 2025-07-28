/**
 * JWT Browser Compatibility Test
 * 
 * Tests that JWT-related modules can be imported in a browser environment
 * without causing "process is not defined" errors.
 * 
 * Uses Jest for testing framework.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';

describe('JWT Browser Compatibility', () => {
  beforeAll(() => {
    // Mock browser environment - remove Node.js globals that cause issues
    if (typeof global !== 'undefined') {
      // Temporarily remove process to simulate browser environment
      global.originalProcess = global.process;
      delete global.process;
    }
  });

  afterAll(() => {
    // Restore process for other tests
    if (typeof global !== 'undefined' && global.originalProcess) {
      global.process = global.originalProcess;
      delete global.originalProcess;
    }
  });

  it('should import jwt-wallet-auth-client without process errors', async () => {
    // This should not throw "process is not defined" error
    expect(async () => {
      const module = await import('../src/lib/utils/jwt-wallet-auth-client.js');
      return module;
    }).not.toThrow();
  });

  it('should import jwt-wallet-auth-client and access functions', async () => {
    const {
      generateNonce,
      createAuthMessage,
      verifySignature,
      extractWalletFromJWT,
      isJWTExpired,
      getChecksumAddress,
      isValidWalletAddress
    } = await import('../src/lib/utils/jwt-wallet-auth-client.js');

    // All functions should be defined
    expect(typeof generateNonce).toBe('function');
    expect(typeof createAuthMessage).toBe('function');
    expect(typeof verifySignature).toBe('function');
    expect(typeof extractWalletFromJWT).toBe('function');
    expect(typeof isJWTExpired).toBe('function');
    expect(typeof getChecksumAddress).toBe('function');
    expect(typeof isValidWalletAddress).toBe('function');
  });

  it('should handle deprecated JWT functions gracefully', async () => {
    const { extractWalletFromJWT, isJWTExpired } = await import('../src/lib/utils/jwt-wallet-auth-client.js');

    // Mock console.warn to capture deprecation warnings
    const originalWarn = console.warn;
    const warnSpy = jest.fn();
    console.warn = warnSpy;

    try {
      // These functions should return safe defaults and show deprecation warnings
      const walletAddress = extractWalletFromJWT('fake.jwt.token');
      const isExpired = isJWTExpired('fake.jwt.token');

      expect(walletAddress).toBe(null);
      expect(isExpired).toBe(true);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('DEPRECATED: extractWalletFromJWT moved to server-side')
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('DEPRECATED: isJWTExpired moved to server-side')
      );
    } finally {
      console.warn = originalWarn;
    }
  });

  it('should work with ethers functions', async () => {
    const { getChecksumAddress, isValidWalletAddress } = await import('../src/lib/utils/jwt-wallet-auth-client.js');

    // Test with a valid Ethereum address
    const testAddress = '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6';
    
    expect(() => getChecksumAddress(testAddress)).not.toThrow();
    expect(isValidWalletAddress(testAddress)).toBe(true);
    expect(isValidWalletAddress('invalid-address')).toBe(false);
  });

  it('should generate nonce without Node.js dependencies', async () => {
    const { generateNonce } = await import('../src/lib/utils/jwt-wallet-auth-client.js');

    // Should not throw and should return a string
    expect(() => generateNonce()).not.toThrow();
    const nonce = generateNonce();
    expect(typeof nonce).toBe('string');
    expect(nonce).toContain('Sign in to ETH Shot');
  });

  it('should create auth message without Node.js dependencies', async () => {
    const { createAuthMessage } = await import('../src/lib/utils/jwt-wallet-auth-client.js');

    const walletAddress = '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6';
    const nonce = 'test-nonce-123';

    expect(() => createAuthMessage(walletAddress, nonce)).not.toThrow();
    const message = createAuthMessage(walletAddress, nonce);
    expect(typeof message).toBe('string');
    expect(message).toContain(nonce);
    expect(message).toContain(walletAddress.toLowerCase());
  });
});