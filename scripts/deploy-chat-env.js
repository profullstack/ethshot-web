#!/usr/bin/env node

import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

/**
 * Parse .env file and extract key-value pairs
 */
function parseEnvFile(filePath) {
  try {
    const envContent = readFileSync(filePath, 'utf8');
    const envVars = {};
    
    envContent.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#') && line.includes('=')) {
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=').replace(/^["']|["']$/g, ''); // Remove quotes
        envVars[key.trim()] = value.trim();
      }
    });
    
    return envVars;
  } catch (error) {
    console.error(`❌ Error reading .env file: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Filter environment variables needed for chat server
 */
function filterChatEnvVars(envVars) {
  const chatVars = {};
  
  // Essential variables for chat server
  const requiredVars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_CHAT_SERVER_URL',
    'CHAT_SERVER_PORT',
    'VITE_CHAT_ENABLED'
  ];
  
  // Optional but useful variables
  const optionalVars = [
    'NODE_ENV',
    'PORT',
    'ALLOWED_ORIGINS'
  ];
  
  // Add all required variables
  requiredVars.forEach(key => {
    if (envVars[key]) {
      chatVars[key] = envVars[key];
    } else {
      console.warn(`⚠️  Warning: Required variable ${key} not found in .env`);
    }
  });
  
  // Add optional variables if they exist
  optionalVars.forEach(key => {
    if (envVars[key]) {
      chatVars[key] = envVars[key];
    }
  });
  
  // Set production defaults
  chatVars.NODE_ENV = 'production';
  chatVars.PORT = '8080';
  
  // Set CORS origins for production
  if (!chatVars.ALLOWED_ORIGINS) {
    chatVars.ALLOWED_ORIGINS = 'https://ethshot.io,https://www.ethshot.io';
  }
  
  return chatVars;
}

/**
 * Upload environment variables to Railway
 */
function uploadToRailway(envVars) {
  console.log('🚀 Uploading environment variables to Railway...\n');
  
  const varCount = Object.keys(envVars).length;
  let successCount = 0;
  
  for (const [key, value] of Object.entries(envVars)) {
    try {
      console.log(`📤 Setting ${key}...`);
      execSync(`railway variables --set "${key}=${value}"`, {
        stdio: 'pipe',
        cwd: join(rootDir, 'servers', 'chat')
      });
      successCount++;
      console.log(`✅ ${key} set successfully`);
    } catch (error) {
      console.error(`❌ Failed to set ${key}: ${error.message}`);
    }
  }
  
  console.log(`\n📊 Upload Summary:`);
  console.log(`   Total variables: ${varCount}`);
  console.log(`   Successfully set: ${successCount}`);
  console.log(`   Failed: ${varCount - successCount}`);
  
  if (successCount === varCount) {
    console.log('\n🎉 All environment variables uploaded successfully!');
    console.log('🔄 Railway will automatically redeploy with new variables');
  } else {
    console.log('\n⚠️  Some variables failed to upload. Check Railway CLI setup.');
  }
}

/**
 * Check if Railway CLI is available and user is logged in
 */
function checkRailwayCLI() {
  try {
    execSync('railway whoami', { stdio: 'pipe' });
    console.log('✅ Railway CLI authenticated');
  } catch (error) {
    console.error('❌ Railway CLI not found or not authenticated');
    console.error('Please run: npm install -g @railway/cli && railway login');
    process.exit(1);
  }
}

/**
 * Main execution
 */
function main() {
  console.log('🔧 ETH Shot Chat Server - Railway Environment Setup\n');
  
  // Check Railway CLI
  checkRailwayCLI();
  
  // Parse .env file
  const envFilePath = join(rootDir, '.env');
  console.log(`📖 Reading environment variables from ${envFilePath}`);
  const allEnvVars = parseEnvFile(envFilePath);
  
  // Filter for chat server variables
  const chatEnvVars = filterChatEnvVars(allEnvVars);
  
  console.log(`\n📋 Chat server environment variables to upload:`);
  Object.keys(chatEnvVars).forEach(key => {
    const value = chatEnvVars[key];
    const displayValue = key.includes('KEY') || key.includes('SECRET') 
      ? `${value.substring(0, 8)}...` 
      : value;
    console.log(`   ${key}=${displayValue}`);
  });
  
  console.log('\n❓ Proceed with upload? (Press Ctrl+C to cancel)');
  
  // Small delay to allow user to cancel
  setTimeout(() => {
    uploadToRailway(chatEnvVars);
  }, 2000);
}

// Run the script
main();