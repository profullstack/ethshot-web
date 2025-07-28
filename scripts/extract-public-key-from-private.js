#!/usr/bin/env node

/**
 * Extract public key from private key JWK
 * This script reads the private key and generates the corresponding public key
 */

import { readFileSync, writeFileSync } from 'fs';
import { createPrivateKey } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

/**
 * Extract public key from private key JWK
 */
function extractPublicKeyFromPrivate() {
  try {
    console.log('🔑 Extracting public key from private key...');
    
    // Read the private key JWK
    const privateKeyPath = join(projectRoot, 'jwk-private-key.json');
    const privateKeyData = JSON.parse(readFileSync(privateKeyPath, 'utf8'));
    
    // Create KeyObject from private key
    const privateKeyObject = createPrivateKey({ key: privateKeyData, format: 'jwk' });
    
    // Extract public key
    const publicKeyObject = createPrivateKey({ key: privateKeyData, format: 'jwk' }).asymmetricKeyType === 'ec' 
      ? privateKeyObject.asymmetricKeyDetails 
      : privateKeyObject;
    
    // Export public key as JWK
    const publicKeyJwk = privateKeyObject.asymmetricKeyDetails 
      ? {
          kty: privateKeyData.kty,
          x: privateKeyData.x,
          y: privateKeyData.y,
          crv: privateKeyData.crv,
          alg: privateKeyData.alg,
          use: 'sig',
          key_ops: ['verify'],
          kid: privateKeyData.kid || null
        }
      : privateKeyObject.export({ format: 'jwk' });
    
    // Remove private key component if present
    delete publicKeyJwk.d;
    
    // Ensure correct key operations
    publicKeyJwk.key_ops = ['verify'];
    publicKeyJwk.use = 'sig';
    
    // Write public key file
    const publicKeyPath = join(projectRoot, 'jwt.json');
    writeFileSync(publicKeyPath, JSON.stringify(publicKeyJwk, null, 2));
    
    console.log('✅ Public key extracted and saved successfully!');
    console.log(`📁 File saved to: ${publicKeyPath}`);
    console.log('\n📋 Public key JWK:');
    console.log(JSON.stringify(publicKeyJwk, null, 2));
    
  } catch (error) {
    console.error('❌ Failed to extract public key:', error);
    process.exit(1);
  }
}

// Run the script
extractPublicKeyFromPrivate();