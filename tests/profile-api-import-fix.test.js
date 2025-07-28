/**
 * Test to verify that profileAPI import fix works correctly
 * This test ensures that the database layer can properly access profileAPI methods
 */

import { expect } from 'chai';
import { db } from '../src/lib/database/index.js';

describe('Profile API Import Fix', () => {
  it('should have profileAPI methods available in database layer', () => {
    // Test that the database layer has the profile methods
    expect(db.upsertUserProfile).to.be.a('function');
    expect(db.isNicknameAvailable).to.be.a('function');
    expect(db.getUserProfile).to.be.a('function');
  });

  it('should not throw "profileAPI is not defined" error when calling profile methods', async () => {
    // This test verifies that the import fix resolves the "profileAPI is not defined" error
    // We'll test with invalid data to avoid actual API calls, but ensure no import errors
    
    try {
      // Test upsertUserProfile - should fail due to missing auth, not import error
      await db.upsertUserProfile({});
    } catch (error) {
      // Should not be a "profileAPI is not defined" error
      expect(error.message).to.not.include('profileAPI is not defined');
      expect(error.message).to.not.include('profileAPI is undefined');
    }

    try {
      // Test isNicknameAvailable - should work as it's a public endpoint
      const result = await db.isNicknameAvailable('test-nickname');
      expect(typeof result).to.equal('boolean');
    } catch (error) {
      // Should not be a "profileAPI is not defined" error
      expect(error.message).to.not.include('profileAPI is not defined');
      expect(error.message).to.not.include('profileAPI is undefined');
    }
  });

  it('should properly import profileAPI instance from profile.js', async () => {
    // Import the profileAPI directly to verify it exists
    const { profileAPI } = await import('../src/lib/api/profile.js');
    
    expect(profileAPI).to.be.an('object');
    expect(profileAPI.upsertProfile).to.be.a('function');
    expect(profileAPI.getProfile).to.be.a('function');
    expect(profileAPI.checkNicknameAvailability).to.be.a('function');
  });
});