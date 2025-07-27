// vite.config.js
import { sveltekit } from "file:///home/ettinger/src/ethshot.io/ethshot-web/node_modules/.pnpm/@sveltejs+kit@2.25.1_@sveltejs+vite-plugin-svelte@3.1.2_svelte@4.2.20_vite@5.4.19_@type_874662bc97f593ac5dbe49a74bae4539/node_modules/@sveltejs/kit/src/exports/vite/index.js";
import { defineConfig } from "file:///home/ettinger/src/ethshot.io/ethshot-web/node_modules/.pnpm/vite@5.4.19_@types+node@24.1.0_lightningcss@1.30.1/node_modules/vite/dist/node/index.js";
var vite_config_default = defineConfig({
  plugins: [sveltekit()],
  // Development server configuration
  server: {
    port: 5173,
    host: true,
    fs: {
      allow: [".."]
    }
  },
  // Build configuration
  build: {
    target: "es2022",
    sourcemap: false,
    // Disable sourcemaps to prevent warnings
    rollupOptions: {
      output: {}
    }
  },
  // Optimization
  optimizeDeps: {
    include: [
      "ethers",
      "web3modal",
      "events",
      "@stablelib/random"
    ],
    exclude: [
      "@walletconnect/web3-provider",
      "@walletconnect/client",
      "@walletconnect/core",
      "@walletconnect/crypto",
      "@walletconnect/encoding",
      "@walletconnect/socket-transport",
      "@walletconnect/browser-utils",
      "@walletconnect/jsonrpc-utils",
      "@walletconnect/environment",
      "@walletconnect/time",
      "pino"
    ]
  },
  // Resolve configuration for WalletConnect compatibility
  resolve: {
    alias: {
      // Fix for WalletConnect environment module
      "@walletconnect/environment": "@walletconnect/environment/dist/esm/index.js",
      // Fix for WalletConnect time module
      "@walletconnect/time": "@walletconnect/time/dist/esm/index.js",
      // Only polyfill events module for EventEmitter
      events: "events",
      // Stub pino logger for browser compatibility
      pino: "/src/lib/utils/pino-stub.js"
    }
  },
  // Define global constants
  define: {
    global: "globalThis",
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
    include: ["src/**/*.{test,spec}.{js,ts}"],
    environment: "jsdom"
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9ldHRpbmdlci9zcmMvZXRoc2hvdC5pby9ldGhzaG90LXdlYlwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2hvbWUvZXR0aW5nZXIvc3JjL2V0aHNob3QuaW8vZXRoc2hvdC13ZWIvdml0ZS5jb25maWcuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2hvbWUvZXR0aW5nZXIvc3JjL2V0aHNob3QuaW8vZXRoc2hvdC13ZWIvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBzdmVsdGVraXQgfSBmcm9tICdAc3ZlbHRlanMva2l0L3ZpdGUnO1xuaW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtzdmVsdGVraXQoKV0sXG4gIFxuICAvLyBEZXZlbG9wbWVudCBzZXJ2ZXIgY29uZmlndXJhdGlvblxuICBzZXJ2ZXI6IHtcbiAgICBwb3J0OiA1MTczLFxuICAgIGhvc3Q6IHRydWUsXG4gICAgZnM6IHtcbiAgICAgIGFsbG93OiBbJy4uJ11cbiAgICB9XG4gIH0sXG4gIFxuICAvLyBCdWlsZCBjb25maWd1cmF0aW9uXG4gIGJ1aWxkOiB7XG4gICAgdGFyZ2V0OiAnZXMyMDIyJyxcbiAgICBzb3VyY2VtYXA6IGZhbHNlLCAvLyBEaXNhYmxlIHNvdXJjZW1hcHMgdG8gcHJldmVudCB3YXJuaW5nc1xuICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgIG91dHB1dDoge31cbiAgICB9XG4gIH0sXG4gIFxuICAvLyBPcHRpbWl6YXRpb25cbiAgb3B0aW1pemVEZXBzOiB7XG4gICAgaW5jbHVkZTogW1xuICAgICAgJ2V0aGVycycsXG4gICAgICAnd2ViM21vZGFsJyxcbiAgICAgICdldmVudHMnLFxuICAgICAgJ0BzdGFibGVsaWIvcmFuZG9tJ1xuICAgIF0sXG4gICAgZXhjbHVkZTogW1xuICAgICAgJ0B3YWxsZXRjb25uZWN0L3dlYjMtcHJvdmlkZXInLFxuICAgICAgJ0B3YWxsZXRjb25uZWN0L2NsaWVudCcsXG4gICAgICAnQHdhbGxldGNvbm5lY3QvY29yZScsXG4gICAgICAnQHdhbGxldGNvbm5lY3QvY3J5cHRvJyxcbiAgICAgICdAd2FsbGV0Y29ubmVjdC9lbmNvZGluZycsXG4gICAgICAnQHdhbGxldGNvbm5lY3Qvc29ja2V0LXRyYW5zcG9ydCcsXG4gICAgICAnQHdhbGxldGNvbm5lY3QvYnJvd3Nlci11dGlscycsXG4gICAgICAnQHdhbGxldGNvbm5lY3QvanNvbnJwYy11dGlscycsXG4gICAgICAnQHdhbGxldGNvbm5lY3QvZW52aXJvbm1lbnQnLFxuICAgICAgJ0B3YWxsZXRjb25uZWN0L3RpbWUnLFxuICAgICAgJ3Bpbm8nXG4gICAgXVxuICB9LFxuICBcbiAgLy8gUmVzb2x2ZSBjb25maWd1cmF0aW9uIGZvciBXYWxsZXRDb25uZWN0IGNvbXBhdGliaWxpdHlcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICAvLyBGaXggZm9yIFdhbGxldENvbm5lY3QgZW52aXJvbm1lbnQgbW9kdWxlXG4gICAgICAnQHdhbGxldGNvbm5lY3QvZW52aXJvbm1lbnQnOiAnQHdhbGxldGNvbm5lY3QvZW52aXJvbm1lbnQvZGlzdC9lc20vaW5kZXguanMnLFxuICAgICAgLy8gRml4IGZvciBXYWxsZXRDb25uZWN0IHRpbWUgbW9kdWxlXG4gICAgICAnQHdhbGxldGNvbm5lY3QvdGltZSc6ICdAd2FsbGV0Y29ubmVjdC90aW1lL2Rpc3QvZXNtL2luZGV4LmpzJyxcbiAgICAgIC8vIE9ubHkgcG9seWZpbGwgZXZlbnRzIG1vZHVsZSBmb3IgRXZlbnRFbWl0dGVyXG4gICAgICBldmVudHM6ICdldmVudHMnLFxuICAgICAgLy8gU3R1YiBwaW5vIGxvZ2dlciBmb3IgYnJvd3NlciBjb21wYXRpYmlsaXR5XG4gICAgICBwaW5vOiAnL3NyYy9saWIvdXRpbHMvcGluby1zdHViLmpzJ1xuICAgIH1cbiAgfSxcbiAgXG4gIC8vIERlZmluZSBnbG9iYWwgY29uc3RhbnRzXG4gIGRlZmluZToge1xuICAgIGdsb2JhbDogJ2dsb2JhbFRoaXMnLFxuICAgIF9fQVBQX1ZFUlNJT05fXzogSlNPTi5zdHJpbmdpZnkocHJvY2Vzcy5lbnYubnBtX3BhY2thZ2VfdmVyc2lvbilcbiAgfSxcbiAgXG4gIC8vIENTUyBjb25maWd1cmF0aW9uXG4gIGNzczoge1xuICAgIHByZXByb2Nlc3Nvck9wdGlvbnM6IHtcbiAgICAgIHNjc3M6IHtcbiAgICAgICAgYWRkaXRpb25hbERhdGE6ICdAdXNlIFwic3JjL3N0eWxlcy92YXJpYWJsZXMuc2Nzc1wiIGFzICo7J1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgXG4gIC8vIFRlc3QgY29uZmlndXJhdGlvblxuICB0ZXN0OiB7XG4gICAgaW5jbHVkZTogWydzcmMvKiovKi57dGVzdCxzcGVjfS57anMsdHN9J10sXG4gICAgZW52aXJvbm1lbnQ6ICdqc2RvbSdcbiAgfVxufSk7Il0sCiAgIm1hcHBpbmdzIjogIjtBQUE2UyxTQUFTLGlCQUFpQjtBQUN2VSxTQUFTLG9CQUFvQjtBQUU3QixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsVUFBVSxDQUFDO0FBQUE7QUFBQSxFQUdyQixRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixJQUFJO0FBQUEsTUFDRixPQUFPLENBQUMsSUFBSTtBQUFBLElBQ2Q7QUFBQSxFQUNGO0FBQUE7QUFBQSxFQUdBLE9BQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxJQUNSLFdBQVc7QUFBQTtBQUFBLElBQ1gsZUFBZTtBQUFBLE1BQ2IsUUFBUSxDQUFDO0FBQUEsSUFDWDtBQUFBLEVBQ0Y7QUFBQTtBQUFBLEVBR0EsY0FBYztBQUFBLElBQ1osU0FBUztBQUFBLE1BQ1A7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNGO0FBQUEsSUFDQSxTQUFTO0FBQUEsTUFDUDtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBO0FBQUEsRUFHQSxTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUE7QUFBQSxNQUVMLDhCQUE4QjtBQUFBO0FBQUEsTUFFOUIsdUJBQXVCO0FBQUE7QUFBQSxNQUV2QixRQUFRO0FBQUE7QUFBQSxNQUVSLE1BQU07QUFBQSxJQUNSO0FBQUEsRUFDRjtBQUFBO0FBQUEsRUFHQSxRQUFRO0FBQUEsSUFDTixRQUFRO0FBQUEsSUFDUixpQkFBaUIsS0FBSyxVQUFVLFFBQVEsSUFBSSxtQkFBbUI7QUFBQSxFQUNqRTtBQUFBO0FBQUEsRUFHQSxLQUFLO0FBQUEsSUFDSCxxQkFBcUI7QUFBQSxNQUNuQixNQUFNO0FBQUEsUUFDSixnQkFBZ0I7QUFBQSxNQUNsQjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUE7QUFBQSxFQUdBLE1BQU07QUFBQSxJQUNKLFNBQVMsQ0FBQyw4QkFBOEI7QUFBQSxJQUN4QyxhQUFhO0FBQUEsRUFDZjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
