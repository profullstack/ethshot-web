import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  
  // Development server configuration
  server: {
    port: 5173,
    host: true,
    fs: {
      allow: ['..']
    }
  },
  
  // Build configuration
  build: {
    target: 'es2022',
    sourcemap: false, // Disable sourcemaps to prevent warnings
    rollupOptions: {
      output: {}
    }
  },
  
  // Optimization
  optimizeDeps: {
    include: [
      'ethers',
      'web3modal',
      'events',
      '@stablelib/random'
    ],
    exclude: [
      '@walletconnect/web3-provider',
      '@walletconnect/client',
      '@walletconnect/core',
      '@walletconnect/crypto',
      '@walletconnect/encoding',
      '@walletconnect/socket-transport',
      '@walletconnect/browser-utils',
      '@walletconnect/jsonrpc-utils',
      '@walletconnect/environment',
      '@walletconnect/time',
      'pino'
    ]
  },
  
  // Resolve configuration for WalletConnect compatibility
  resolve: {
    alias: {
      // Fix for WalletConnect environment module
      '@walletconnect/environment': '@walletconnect/environment/dist/esm/index.js',
      // Fix for WalletConnect time module
      '@walletconnect/time': '@walletconnect/time/dist/esm/index.js',
      // Only polyfill events module for EventEmitter
      events: 'events',
      // Stub pino logger for browser compatibility
      pino: '/src/lib/utils/pino-stub.js'
    }
  },
  
  // Define global constants
  define: {
    global: 'globalThis',
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version)
  },
  
  // CSS configuration
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: '@use "src/styles/variables.scss" as *;'
      }
    }
  },
  
  // Test configuration
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
    environment: 'jsdom'
  }
});