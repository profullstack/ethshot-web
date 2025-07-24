// Environment variable debugging utility
// Use this to verify environment variables are properly set in production

/**
 * Debug environment variables (safe for production)
 * Only logs non-sensitive configuration values
 */
export const debugEnvironmentVariables = () => {
  if (typeof window === 'undefined') {
    console.warn('Environment debug: Running on server, skipping client env check');
    return;
  }

  console.group('🔍 Environment Variables Debug');
  
  // Contract configuration
  console.log('📄 Contract Configuration:');
  console.log('  CONTRACT_ADDRESS:', import.meta.env.VITE_CONTRACT_ADDRESS || '❌ NOT SET');
  console.log('  CHAIN_ID:', import.meta.env.VITE_CHAIN_ID || '❌ NOT SET');
  console.log('  NETWORK_NAME:', import.meta.env.VITE_NETWORK_NAME || '❌ NOT SET');
  
  // RPC configuration
  console.log('🌐 Network Configuration:');
  console.log('  RPC_URL:', import.meta.env.VITE_RPC_URL ? '✅ SET' : '❌ NOT SET');
  console.log('  BLOCK_EXPLORER_URL:', import.meta.env.VITE_BLOCK_EXPLORER_URL || '❌ NOT SET');
  
  // Database configuration
  console.log('🗄️ Database Configuration:');
  console.log('  SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL ? '✅ SET' : '❌ NOT SET');
  console.log('  SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ SET' : '❌ NOT SET');
  
  // App configuration
  console.log('🚀 App Configuration:');
  console.log('  APP_URL:', import.meta.env.VITE_APP_URL || '❌ NOT SET');
  console.log('  WALLETCONNECT_PROJECT_ID:', import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ? '✅ SET' : '❌ NOT SET');
  
  // Check for common issues
  const issues = [];
  
  if (!import.meta.env.VITE_CONTRACT_ADDRESS) {
    issues.push('❌ VITE_CONTRACT_ADDRESS is not set - this will cause "Contract address not configured" error');
  } else if (import.meta.env.VITE_CONTRACT_ADDRESS === '0x1234567890123456789012345678901234567890') {
    issues.push('❌ VITE_CONTRACT_ADDRESS is using placeholder value');
  }
  
  if (!import.meta.env.VITE_RPC_URL) {
    issues.push('❌ VITE_RPC_URL is not set - blockchain connection will fail');
  }
  
  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    issues.push('❌ Supabase configuration incomplete - database features will fail');
  }
  
  if (issues.length > 0) {
    console.group('🚨 Configuration Issues Found:');
    issues.forEach(issue => console.warn(issue));
    console.groupEnd();
  } else {
    console.log('✅ All required environment variables are configured');
  }
  
  console.groupEnd();
};

/**
 * Get environment status for display in UI
 */
export const getEnvironmentStatus = () => {
  const requiredVars = [
    'VITE_CONTRACT_ADDRESS',
    'VITE_RPC_URL',
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY'
  ];
  
  const missing = requiredVars.filter(varName => !import.meta.env[varName]);
  const isConfigured = missing.length === 0;
  
  return {
    isConfigured,
    missing,
    contractAddress: import.meta.env.VITE_CONTRACT_ADDRESS,
    networkName: import.meta.env.VITE_NETWORK_NAME || 'Unknown',
    chainId: import.meta.env.VITE_CHAIN_ID || 'Unknown'
  };
};

/**
 * Validate contract address format
 */
export const validateContractAddress = (address) => {
  if (!address) return { valid: false, error: 'Contract address not provided' };
  
  // Check if it's a valid Ethereum address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return { valid: false, error: 'Invalid Ethereum address format' };
  }
  
  // Check if it's the placeholder address
  if (address === '0x1234567890123456789012345678901234567890') {
    return { valid: false, error: 'Using placeholder contract address' };
  }
  
  return { valid: true };
};