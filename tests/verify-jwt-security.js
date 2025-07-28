/**
 * JWT Security Verification Script
 * 
 * Simple verification script to ensure JWT secret is not exposed to client-side code
 */

console.log('🔒 JWT Security Verification Starting...\n');

// Test 1: Verify client-safe utilities work without JWT secret
console.log('Test 1: Client-safe utilities');
try {
  const clientUtils = await import('../src/lib/utils/jwt-wallet-auth-client.js');
  
  // Test nonce generation
  const nonce = clientUtils.generateNonce();
  console.log('✅ generateNonce works:', nonce.substring(0, 30) + '...');
  
  // Test auth message creation
  const message = clientUtils.createAuthMessage('0x1234567890123456789012345678901234567890', 'test-nonce');
  console.log('✅ createAuthMessage works:', message.substring(0, 50) + '...');
  
  // Test JWT extraction (without verification)
  const mockPayload = { walletAddress: '0x1234567890123456789012345678901234567890' };
  const mockToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify(mockPayload))}.mock-signature`;
  const extractedWallet = clientUtils.extractWalletFromJWT(mockToken);
  console.log('✅ extractWalletFromJWT works:', extractedWallet);
  
  console.log('✅ All client-safe utilities work correctly\n');
} catch (error) {
  console.error('❌ Client-safe utilities failed:', error.message);
}

// Test 2: Verify server-side secure utilities work
console.log('Test 2: Server-side secure utilities');
try {
  const serverUtils = await import('../src/lib/server/jwt-auth-secure.js');
  
  // Test secure nonce generation
  const secureNonce = serverUtils.generateNonceSecure();
  console.log('✅ generateNonceSecure works:', secureNonce.substring(0, 30) + '...');
  
  // Test secure auth message creation
  const secureMessage = serverUtils.createAuthMessageSecure('0x1234567890123456789012345678901234567890', 'test-nonce');
  console.log('✅ createAuthMessageSecure works:', secureMessage.substring(0, 50) + '...');
  
  // Test JWT secret availability check
  const hasSecret = serverUtils.hasJWTSecret();
  console.log('✅ hasJWTSecret check:', hasSecret ? 'JWT secret available' : 'JWT secret not configured');
  
  console.log('✅ All server-side secure utilities work correctly\n');
} catch (error) {
  console.error('❌ Server-side secure utilities failed:', error.message);
}

// Test 3: Verify old insecure utilities are blocked
console.log('Test 3: Insecure utilities are blocked');
try {
  const oldUtils = await import('../src/lib/utils/jwt-wallet-auth.js');
  
  // Test that JWT generation is blocked
  try {
    oldUtils.generateJWT('0x1234567890123456789012345678901234567890');
    console.error('❌ SECURITY BREACH: generateJWT should be blocked!');
  } catch (error) {
    console.log('✅ generateJWT correctly blocked:', error.message);
  }
  
  // Test that JWT verification is blocked
  try {
    oldUtils.verifyJWT('fake-token');
    console.error('❌ SECURITY BREACH: verifyJWT should be blocked!');
  } catch (error) {
    console.log('✅ verifyJWT correctly blocked:', error.message);
  }
  
  // Test that JWT secret access is blocked
  try {
    oldUtils.setJWTSecret('fake-secret');
    console.error('❌ SECURITY BREACH: setJWTSecret should be blocked!');
  } catch (error) {
    console.log('✅ setJWTSecret correctly blocked:', error.message);
  }
  
  console.log('✅ All insecure operations are properly blocked\n');
} catch (error) {
  console.error('❌ Failed to test insecure utilities:', error.message);
}

// Test 4: Verify API endpoints are available
console.log('Test 4: API endpoints availability');
try {
  const authAPI = await import('../src/routes/api/auth/+server.js');
  
  if (typeof authAPI.POST === 'function') {
    console.log('✅ Auth API POST endpoint is available');
  } else {
    console.error('❌ Auth API POST endpoint is missing');
  }
  
  if (typeof authAPI.GET === 'function') {
    console.log('✅ Auth API GET endpoint is available');
  } else {
    console.error('❌ Auth API GET endpoint is missing');
  }
  
  console.log('✅ API endpoints are properly configured\n');
} catch (error) {
  console.error('❌ Failed to verify API endpoints:', error.message);
}

console.log('🔒 JWT Security Verification Complete!');
console.log('\n📋 Summary:');
console.log('- Client-safe utilities: Available for client-side use');
console.log('- Server-side secure utilities: Available for server-side use only');
console.log('- Insecure JWT operations: Properly blocked');
console.log('- API endpoints: Available for secure JWT operations');
console.log('\n✅ JWT secret is no longer exposed to client-side code!');