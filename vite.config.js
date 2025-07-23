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
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['ethers'],
          web3: ['@walletconnect/web3-provider', 'web3modal']
        }
      }
    }
  },
  
  // Optimization
  optimizeDeps: {
    include: ['ethers', 'web3modal'],
    exclude: ['@walletconnect/web3-provider']
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