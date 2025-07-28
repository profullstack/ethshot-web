#!/usr/bin/env node

/**
 * Generate JWK (JSON Web Key) private key from PEM format
 * This script converts our ES256 private key from PEM to JWK format
 */

import { readFileSync, writeFileSync } from 'fs';
import { createPrivateKey } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

/**
 * Convert PEM private key to JWK format
 * @param {string} pemKey - PEM formatted private key
 * @returns {Object} JWK formatted private key
 */
function pemToJwk(pemKey) {
  try {
    // Create a KeyObject from the PEM key
    const keyObject = createPrivateKey(pemKey);
    
    // Export as JWK
    const jwk = keyObject.export({ format: 'jwk' });
    
    // Add additional JWK properties for ES256
    return {
      ...jwk,
      alg: 'ES256',
      use: 'sig',
      key_ops: ['sign']
    };
  } catch (error) {
    console.error('❌ Failed to convert PEM to JWK:', error);
    throw error;
  }
}

/**
 * Main function to generate JWK private key file
 */
function generateJwkPrivateKey() {
  try {
    console.log('🔑 Converting PEM private key to JWK format...');
    
    // Read the PEM private key
    const pemKeyPath = join(projectRoot, 'private-key.pem');
    const pemKey = readFileSync(pemKeyPath, 'utf8');
    
    // Convert to JWK
    const jwkPrivateKey = pemToJwk(pemKey);
    
    // Write JWK private key file
    const jwkPrivateKeyPath = join(projectRoot, 'jwk-private-key.json');
    writeFileSync(jwkPrivateKeyPath, JSON.stringify(jwkPrivateKey, null, 2));
    
    console.log('✅ JWK private key generated successfully!');
    console.log(`📁 File saved to: ${jwkPrivateKeyPath}`);
    console.log('\n🔒 SECURITY WARNING:');
    console.log('- This file contains your private key and should NEVER be committed to version control');
    console.log('- Make sure jwk-private-key.json is added to .gitignore');
    console.log('- Keep this file secure and never share it publicly');
    
    // Display the JWK (without the private key components for security)
    const publicJwk = { ...jwkPrivateKey };
    delete publicJwk.d; // Remove private key component
    console.log('\n📋 Public JWK (safe to share):');
    console.log(JSON.stringify(publicJwk, null, 2));
    
  } catch (error) {
    console.error('❌ Failed to generate JWK private key:', error);
    process.exit(1);
  }
}

// Run the script
generateJwkPrivateKey();