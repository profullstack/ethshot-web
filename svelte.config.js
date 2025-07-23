import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://kit.svelte.dev/docs/integrations#preprocessors
  // for more information about preprocessors
  preprocess: vitePreprocess(),

  kit: {
    // adapter-auto only supports some environments, see https://kit.svelte.dev/docs/adapter-auto for a list.
    // If your environment is not supported or you settled on a specific environment, switch out the adapter.
    // See https://kit.svelte.dev/docs/adapters for more information about adapters.
    adapter: adapter(),
    
    // App configuration
    appDir: 'app',
    
    // Files configuration
    files: {
      assets: 'public',
      hooks: {
        client: 'src/hooks.client.js',
        server: 'src/hooks.server.js'
      },
      lib: 'src/lib',
      params: 'src/params',
      routes: 'src/routes',
      serviceWorker: 'src/service-worker.js',
      template: 'src/app.html'
    },
    
    // Environment variables
    env: {
      publicPrefix: 'PUBLIC_'
    },
    
    // CSP configuration for Web3 compatibility
    csp: {
      mode: 'auto',
      directives: {
        'script-src': ['self', 'unsafe-inline', 'unsafe-eval'],
        'object-src': ['none'],
        'base-uri': ['self']
      }
    },
    
    // Preload strategy
    preloadStrategy: 'modulepreload',
    
    // Version configuration
    version: {
      name: process.env.npm_package_version
    }
  }
};

export default config;