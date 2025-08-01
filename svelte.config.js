import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://kit.svelte.dev/docs/integrations#preprocessors
  // for more information about preprocessors
  preprocess: vitePreprocess(),

  // Suppress deprecation warnings from third-party libraries
  onwarn: (warning, handler) => {
    // Suppress the "Components object is deprecated" warning from WalletConnect libraries
    if (warning.message.includes('Components object is deprecated')) {
      return;
    }
    // Suppress other common third-party deprecation warnings
    if (warning.message.includes('deprecated') && warning.filename?.includes('node_modules')) {
      return;
    }
    // Handle all other warnings normally
    handler(warning);
  },

  kit: {
    // Use Vercel adapter with explicit Node.js runtime version
    adapter: adapter({
      runtime: 'nodejs20.x'
    }),
    
    // CSP configuration for Web3 compatibility
    csp: {
      mode: 'auto',
      directives: {
        'script-src': ['self', 'unsafe-inline', 'unsafe-eval'],
        'object-src': ['none'],
        'base-uri': ['self']
      }
    }
  }
};

export default config;