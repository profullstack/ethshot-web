/**
 * Server-side Configuration
 * 
 * Dedicated server-side configuration that uses dotenv to load environment variables.
 * This file should ONLY be used in server-side code (API routes, server-side utilities).
 * 
 * IMPORTANT: This file should never be imported in client-side code as it contains
 * sensitive server-side environment variables.
 */

import { config } from 'dotenv';
import { dev } from '$app/environment';

// Load environment variables from .env file
config();

/**
 * Server-side environment configuration
 */
export const SERVER_CONFIG = {
  // Supabase Configuration (Server-side only)
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET,
  
  // Game Configuration (Server-side access)
  SHOT_COST_ETH: parseFloat(process.env.VITE_SHOT_COST_ETH || '0.0005'),
  FIRST_SHOT_COST_ETH: parseFloat(process.env.VITE_FIRST_SHOT_COST_ETH || '0.001'),
  SPONSOR_COST_ETH: parseFloat(process.env.VITE_SPONSOR_COST_ETH || '0.001'),
  
  // Development mode flag
  isDevelopment: dev,
  
  // Validation flags
  isConfigured: false,
  missingVariables: []
};

/**
 * Validate and initialize server configuration
 */
function initializeServerConfig() {
  // Define required server-side variables
  const requiredVars = [
    { key: 'SUPABASE_URL', value: SERVER_CONFIG.SUPABASE_URL },
    { key: 'SUPABASE_ANON_KEY', value: SERVER_CONFIG.SUPABASE_ANON_KEY },
    { key: 'SUPABASE_SERVICE_ROLE_KEY', value: SERVER_CONFIG.SUPABASE_SERVICE_ROLE_KEY },
    { key: 'SUPABASE_JWT_SECRET', value: SERVER_CONFIG.SUPABASE_JWT_SECRET }
  ];

  // Check for missing variables
  SERVER_CONFIG.missingVariables = requiredVars
    .filter(({ value }) => !value)
    .map(({ key }) => key);

  SERVER_CONFIG.isConfigured = SERVER_CONFIG.missingVariables.length === 0;

  // Log configuration status in development
  if (SERVER_CONFIG.isDevelopment) {
    console.log('🔧 Server Environment Configuration:');
    console.log(`  SUPABASE_URL: ${SERVER_CONFIG.SUPABASE_URL ? '✅ SET' : '❌ MISSING'}`);
    console.log(`  SUPABASE_ANON_KEY: ${SERVER_CONFIG.SUPABASE_ANON_KEY ? '✅ SET' : '❌ MISSING'}`);
    console.log(`  SUPABASE_SERVICE_ROLE_KEY: ${SERVER_CONFIG.SUPABASE_SERVICE_ROLE_KEY ? '✅ SET' : '❌ MISSING'}`);
    console.log(`  SUPABASE_JWT_SECRET: ${SERVER_CONFIG.SUPABASE_JWT_SECRET ? '✅ SET' : '❌ MISSING'}`);
    
    if (!SERVER_CONFIG.isConfigured) {
      console.warn('⚠️ Missing required environment variables:', SERVER_CONFIG.missingVariables);
      console.warn('⚠️ Server-side authentication will not work until these are configured');
    } else {
      console.log('✅ All required server environment variables are configured');
    }
  }

  return SERVER_CONFIG;
}

// Initialize configuration on module load
initializeServerConfig();

/**
 * Get server-side environment configuration
 * @returns {Object} Server configuration object
 */
export function getServerConfig() {
  return SERVER_CONFIG;
}

/**
 * Check if server-side configuration is complete
 * @returns {boolean} True if all required variables are configured
 */
export function isServerConfigured() {
  return SERVER_CONFIG.isConfigured;
}

/**
 * Get list of missing environment variables
 * @returns {string[]} Array of missing variable names
 */
export function getMissingVariables() {
  return SERVER_CONFIG.missingVariables;
}

/**
 * Create a configuration error response for API endpoints
 * @returns {Object} Error response object
 */
export function createConfigurationError() {
  return {
    success: false,
    error: 'Server configuration incomplete',
    message: `Missing required environment variables: ${SERVER_CONFIG.missingVariables.join(', ')}`,
    details: {
      missingVariables: SERVER_CONFIG.missingVariables,
      isDevelopment: SERVER_CONFIG.isDevelopment,
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
  if (!SERVER_CONFIG.isConfigured) {
    const error = new Error(
      `${context} failed: Missing required environment variables: ${SERVER_CONFIG.missingVariables.join(', ')}`
    );
    error.code = 'SERVER_CONFIG_INCOMPLETE';
    error.missingVariables = SERVER_CONFIG.missingVariables;
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
  SHOT_COST_ETH,
  FIRST_SHOT_COST_ETH,
  SPONSOR_COST_ETH,
  isDevelopment
} = SERVER_CONFIG;