/**
 * Legacy Game Store - Backward Compatibility Layer
 * 
 * This file provides backward compatibility by re-exporting
 * the unified game store as the legacy game store.
 * 
 * All new development should use game-unified.js directly.
 */

// Re-export everything from the unified store
export * from './game-unified.js';

// Ensure the main gameStore export is available
export { gameStore } from './game-unified.js';