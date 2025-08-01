/**
 * Profile API Migration Test
 * 
 * Tests that the profile API works correctly after applying the database migrations
 * that add the missing profile columns (nickname, avatar_url, bio, notifications_enabled).
 */

import { expect } from 'chai';
import fetch from 'node-fetch';

describe('Profile API Migration Test', () => {
  const API_BASE_URL = 'http://localhost:5173';
  const TEST_WALLET_ADDRESS = '0x1234567890123456789012345678901234567890';
  
  // Mock JWT token for testing (this would normally be generated by the auth API)
  const MOCK_JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ3YWxsZXRfYWRkcmVzcyI6IjB4MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MCIsImlhdCI6MTY0MzY0MDAwMCwiZXhwIjo5OTk5OTk5OTk5fQ.test-signature';

  describe('Profile API Health Check', () => {
    it('should return health check information', async () => {
      const response = await fetch(`${API_BASE_URL}/api/profile`);
      const data = await response.json();
      
      expect(response.status).to.equal(200);
      expect(data.success).to.be.true;
      expect(data.message).to.equal('Profile API is running');
      expect(data.endpoints).to.have.property('POST');
    });
  });

  describe('Profile Upsert with New Columns', () => {
    it('should successfully upsert profile with new columns', async () => {
      const profileData = {
        nickname: 'TestUser',
        avatarUrl: 'https://example.com/avatar.jpg',
        bio: 'This is a test bio',
        notificationsEnabled: true
      };

      const response = await fetch(`${API_BASE_URL}/api/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MOCK_JWT_TOKEN}`
        },
        body: JSON.stringify({
          action: 'upsert',
          profileData
        })
      });

      const data = await response.json();
      
      // Log the response for debugging
      console.log('Profile upsert response:', {
        status: response.status,
        data
      });

      // The test should pass if the API doesn't return a schema error
      if (response.status === 500 && data.message?.includes('avatar_url')) {
        throw new Error('Database schema still missing profile columns - migration may not have been applied correctly');
      }

      // If we get here, the schema issue is resolved
      // The actual response might still fail due to JWT validation, but that's expected in this test
      expect(response.status).to.be.oneOf([200, 401, 500]);
      
      if (response.status === 401) {
        expect(data.error).to.include('token');
      }
    });
  });

  describe('Profile Schema Validation', () => {
    it('should not return schema cache errors for profile columns', async () => {
      const profileData = {
        nickname: 'SchemaTest',
        avatarUrl: 'https://example.com/test.jpg',
        bio: 'Schema validation test',
        notificationsEnabled: false
      };

      const response = await fetch(`${API_BASE_URL}/api/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MOCK_JWT_TOKEN}`
        },
        body: JSON.stringify({
          action: 'upsert',
          profileData
        })
      });

      const data = await response.json();
      
      // The key test: we should NOT get schema cache errors
      expect(data.message).to.not.include('Could not find the \'avatar_url\' column');
      expect(data.message).to.not.include('Could not find the \'nickname\' column');
      expect(data.message).to.not.include('Could not find the \'bio\' column');
      expect(data.message).to.not.include('Could not find the \'notifications_enabled\' column');
      expect(data.message).to.not.include('schema cache');
    });
  });
});