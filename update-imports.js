#!/usr/bin/env node

/**
 * Import Update Script
 * 
 * Updates all imports from old monolithic files to new modular structure
 */

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

const files = await glob('src/**/*.{js,svelte}', { ignore: ['src/lib/stores/game/**', 'src/lib/database/**'] });

let updatedCount = 0;

for (const file of files) {
  try {
    let content = readFileSync(file, 'utf8');
    let modified = false;

    // Update game-unified.js imports
    if (content.includes('game-unified.js')) {
      content = content.replace(/from ['"]([^'"]*\/)?stores\/game-unified\.js['"]/g, "from '$1stores/game/index.js'");
      content = content.replace(/from ['"]([^'"]*\/)?lib\/stores\/game-unified\.js['"]/g, "from '$1lib/stores/game/index.js'");
      modified = true;
    }

    // Update supabase.js imports
    if (content.includes('supabase.js')) {
      content = content.replace(/from ['"]([^'"]*\/)?supabase\.js['"]/g, "from '$1database/index.js'");
      content = content.replace(/from ['"]([^'"]*\/)?lib\/supabase\.js['"]/g, "from '$1lib/database/index.js'");
      modified = true;
    }

    if (modified) {
      writeFileSync(file, content);
      console.log(`✅ Updated: ${file}`);
      updatedCount++;
    }
  } catch (error) {
    console.error(`❌ Error updating ${file}:`, error.message);
  }
}

console.log(`\n🎉 Updated ${updatedCount} files with new import paths`);