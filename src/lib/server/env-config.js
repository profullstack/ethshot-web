/**
 * Server-side Environment Configuration
 * 
 * Centralized environment variable loading and validation for server-side operations.
 * This ensures all required environment variables are available and properly configured.
 */

import { dev } from '$app/environment';

/**
 * Load environment variables with fallbacks and validation
 */
function loadEnvironmentVariables() {
  const config = {
    // Supabase Configuration
    SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET,
    
    // Development mode flag
    isDevelopment: dev,
    
    // Validation flags
    isConfigured: false,
    missingVariables: []
  };

  // Validate required variables
  const requiredVars = [
    { key: 'SUPABASE_URL', value: config.SUPABASE_URL },
    { key: 'SUPABASE_ANON_KEY', value: config.SUPABASE_ANON_KEY },
    { key: 'SUPABASE_SERVICE_ROLE_KEY', value: config.SUPABASE_SERVICE_ROLE_KEY },
    { key: 'SUPABASE_JWT_SECRET', value: config.SUPABASE_JWT_SECRET }
  ];

  // Check for missing variables
  config.missingVariables = requiredVars
    .filter(({ value }) => !value)
    .map(({ key }) => key);

  config.isConfigured = config.missingVariables.length === 0;

  // Log configuration status
  if (config.isDevelopment) {
    console.log('🔧 Server Environment Configuration:');
    console.log(`  SUPABASE_URL: ${config.SUPABASE_URL ? '✅ SET' : '❌ MISSING'}`);
    console.log(`  SUPABASE_ANON_KEY: ${config.SUPABASE_ANON_KEY ? '✅ SET' : '❌ MISSING'}`);
    console.log(`  SUPABASE_SERVICE_ROLE_KEY: ${config.SUPABASE_SERVICE_ROLE_KEY ? '✅ SET' : '❌ MISSING'}`);
    console.log(`  SUPABASE_JWT_SECRET: ${config.SUPABASE_JWT_SECRET ? '✅ SET' : '❌ MISSING'}`);
    
    if (!config.isConfigured) {
      console.warn('⚠️ Missing required environment variables:', config.missingVariables);
      console.warn('⚠️ Server-side authentication will not work until these are configured');
    } else {
      console.log('✅ All required environment variables are configured');
    }
  }

  return config;
}

// Load configuration once at module initialization
export const serverConfig = loadEnvironmentVariables();

/**
 * Get server-side environment configuration
 * @returns {Object} Server configuration object
 */
export function getServerConfig() {
  return serverConfig;
}

/**
 * Check if server-side configuration is complete
 * @returns {boolean} True if all required variables are configured
 */
export function isServerConfigured() {
  return serverConfig.isConfigured;
}

/**
 * Get list of missing environment variables
 * @returns {string[]} Array of missing variable names
 */
export function getMissingVariables() {
  return serverConfig.missingVariables;
}

/**
 * Create a configuration error response for API endpoints
 * @returns {Object} Error response object
 */
export function createConfigurationError() {
  return {
    success: false,
    error: 'Server configuration incomplete',
    message: `Missing required environment variables: ${serverConfig.missingVariables.join(', ')}`,
    details: {
      missingVariables: serverConfig.missingVariables,
      isDevelopment: serverConfig.isDevelopment,
      help: 'Please ensure all required environment variables are set in your .env file or deployment environment'
    }
  };
}

/**
 * Validate server configuration and throw error if incomplete
 * @param {string} context - Context where validation is being performed
 * @throws {Error} If configuration is incomplete
 */
export function validateServerConfig(context = 'Server operation') {
  if (!serverConfig.isConfigured) {
    const error = new Error(
      `${context} failed: Missing required environment variables: ${serverConfig.missingVariables.join(', ')}`
    );
    error.code = 'SERVER_CONFIG_INCOMPLETE';
    error.missingVariables = serverConfig.missingVariables;
    throw error;
  }
}

/**
 * Get environment variable with fallback and validation
 * @param {string} primaryKey - Primary environment variable key
 * @param {string[]} fallbackKeys - Fallback keys to try
 * @param {boolean} required - Whether the variable is required
 * @returns {string|null} Environment variable value or null
 */
export function getEnvVar(primaryKey, fallbackKeys = [], required = false) {
  let value = process.env[primaryKey];
  
  // Try fallback keys if primary is not set
  if (!value && fallbackKeys.length > 0) {
    for (const fallbackKey of fallbackKeys) {
      value = process.env[fallbackKey];
      if (value) break;
    }
  }
  
  if (required && !value) {
    throw new Error(`Required environment variable not found: ${primaryKey} (also tried: ${fallbackKeys.join(', ')})`);
  }
  
  return value || null;
}

// Export individual configuration values for convenience
export const {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_JWT_SECRET,
  isDevelopment
} = serverConfig;