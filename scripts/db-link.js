#!/usr/bin/env node

import { execSync } from 'child_process';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

config({ path: join(projectRoot, '.env') });

// Extract project reference from VITE_SUPABASE_URL
const supabaseUrl = process.env.VITE_SUPABASE_URL;

if (!supabaseUrl) {
  console.error('❌ VITE_SUPABASE_URL not found in .env file');
  process.exit(1);
}

// Extract project reference from URL like https://oalbonsiquulspxoimqp.supabase.co
const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);

if (!match) {
  console.error('❌ Invalid VITE_SUPABASE_URL format. Expected: https://PROJECT_REF.supabase.co');
  process.exit(1);
}

const projectRef = match[1];

console.log(`🔗 Linking to Supabase project: ${projectRef}`);

try {
  execSync(`supabase link --project-ref ${projectRef}`, { 
    stdio: 'inherit',
    cwd: projectRoot
  });
  console.log('✅ Successfully linked to Supabase project!');
} catch (error) {
  console.error('❌ Failed to link to Supabase project');
  process.exit(1);
}