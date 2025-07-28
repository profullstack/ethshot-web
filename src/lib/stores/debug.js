import { writable, derived } from 'svelte/store';
import { userProfile } from './profile.js';

/**
 * Debug Mode Store
 * 
 * Manages the debug mode state based on user profile settings.
 * Debug information is only shown when the user has explicitly enabled debug mode.
 */

// Create a derived store that tracks debug mode from user profile
export const debugMode = derived(
  userProfile,
  ($userProfile) => {
    // Default to false if no profile or debug_mode is not set
    return $userProfile?.debug_mode ?? false;
  }
);

// Helper function to check if debug mode is enabled
export const isDebugEnabled = () => {
  let debugEnabled = false;
  debugMode.subscribe(value => {
    debugEnabled = value;
  })();
  return debugEnabled;
};

// Export for easy access in components
export default debugMode;