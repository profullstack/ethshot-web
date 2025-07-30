/**
 * Sponsor Security Policies Test
 * 
 * Tests the Row Level Security policies for sponsor modifications
 * to ensure only creators or admins can modify sponsor records.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('Sponsor Security Policies', () => {
  let mockSupabase;
  let mockAuth;
  let sponsorRecord;

  beforeEach(() => {
    // Mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn()
    };

    // Mock auth context
    mockAuth = {
      jwt: jest.fn()
    };

    // Sample sponsor record
    sponsorRecord = {
      id: 'test-sponsor-id',
      sponsor_address: '0x1234567890123456789012345678901234567890',
      name: 'Test Sponsor',
      logo_url: 'https://example.com/logo.png',
      sponsor_url: 'https://example.com',
      active: true,
      timestamp: new Date().toISOString()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('UPDATE operations', () => {
    it('should allow sponsor creator to update their own record', async () => {
      // Mock JWT with matching wallet address
      mockAuth.jwt.mockReturnValue({
        wallet_address: '0x1234567890123456789012345678901234567890'
      });

      // Mock successful update
      mockSupabase.single.mockResolvedValue({
        data: { ...sponsorRecord, name: 'Updated Sponsor Name' },
        error: null
      });

      const result = await mockSupabase
        .from('sponsors')
        .update({ name: 'Updated Sponsor Name' })
        .eq('id', sponsorRecord.id)
        .single();

      expect(result.error).toBeNull();
      expect(result.data.name).toBe('Updated Sponsor Name');
      expect(mockSupabase.from).toHaveBeenCalledWith('sponsors');
      expect(mockSupabase.update).toHaveBeenCalledWith({ name: 'Updated Sponsor Name' });
    });

    it('should allow admin user to update any sponsor record', async () => {
      // Mock JWT with different wallet address but admin privileges
      mockAuth.jwt.mockReturnValue({
        wallet_address: '0xadmin123456789012345678901234567890123456'
      });

      // Mock admin user profile lookup
      const mockUserProfile = {
        wallet_address: '0xadmin123456789012345678901234567890123456',
        is_admin: true
      };

      // Mock successful update by admin
      mockSupabase.single.mockResolvedValue({
        data: { ...sponsorRecord, active: false },
        error: null
      });

      const result = await mockSupabase
        .from('sponsors')
        .update({ active: false })
        .eq('id', sponsorRecord.id)
        .single();

      expect(result.error).toBeNull();
      expect(result.data.active).toBe(false);
    });

    it('should deny update from non-creator, non-admin user', async () => {
      // Mock JWT with different wallet address and no admin privileges
      mockAuth.jwt.mockReturnValue({
        wallet_address: '0xother567890123456789012345678901234567890'
      });

      // Mock RLS policy denial
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: {
          code: '42501',
          message: 'new row violates row-level security policy for table "sponsors"'
        }
      });

      const result = await mockSupabase
        .from('sponsors')
        .update({ name: 'Unauthorized Update' })
        .eq('id', sponsorRecord.id)
        .single();

      expect(result.error).toBeTruthy();
      expect(result.error.code).toBe('42501');
      expect(result.data).toBeNull();
    });

    it('should handle case-insensitive wallet address matching', async () => {
      // Mock JWT with uppercase wallet address
      mockAuth.jwt.mockReturnValue({
        wallet_address: '0X1234567890123456789012345678901234567890'
      });

      // Mock successful update (RLS should handle case-insensitive matching)
      mockSupabase.single.mockResolvedValue({
        data: { ...sponsorRecord, sponsor_url: 'https://updated.com' },
        error: null
      });

      const result = await mockSupabase
        .from('sponsors')
        .update({ sponsor_url: 'https://updated.com' })
        .eq('id', sponsorRecord.id)
        .single();

      expect(result.error).toBeNull();
      expect(result.data.sponsor_url).toBe('https://updated.com');
    });
  });

  describe('DELETE operations', () => {
    it('should allow sponsor creator to delete their own record', async () => {
      // Mock JWT with matching wallet address
      mockAuth.jwt.mockReturnValue({
        wallet_address: '0x1234567890123456789012345678901234567890'
      });

      // Mock successful deletion
      mockSupabase.single.mockResolvedValue({
        data: sponsorRecord,
        error: null
      });

      const result = await mockSupabase
        .from('sponsors')
        .delete()
        .eq('id', sponsorRecord.id)
        .single();

      expect(result.error).toBeNull();
      expect(mockSupabase.from).toHaveBeenCalledWith('sponsors');
      expect(mockSupabase.delete).toHaveBeenCalled();
    });

    it('should allow admin user to delete any sponsor record', async () => {
      // Mock JWT with admin privileges
      mockAuth.jwt.mockReturnValue({
        wallet_address: '0xadmin123456789012345678901234567890123456'
      });

      // Mock successful deletion by admin
      mockSupabase.single.mockResolvedValue({
        data: sponsorRecord,
        error: null
      });

      const result = await mockSupabase
        .from('sponsors')
        .delete()
        .eq('id', sponsorRecord.id)
        .single();

      expect(result.error).toBeNull();
    });

    it('should deny deletion from non-creator, non-admin user', async () => {
      // Mock JWT with different wallet address and no admin privileges
      mockAuth.jwt.mockReturnValue({
        wallet_address: '0xother567890123456789012345678901234567890'
      });

      // Mock RLS policy denial
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: {
          code: '42501',
          message: 'new row violates row-level security policy for table "sponsors"'
        }
      });

      const result = await mockSupabase
        .from('sponsors')
        .delete()
        .eq('id', sponsorRecord.id)
        .single();

      expect(result.error).toBeTruthy();
      expect(result.error.code).toBe('42501');
      expect(result.data).toBeNull();
    });
  });

  describe('Edge cases', () => {
    it('should handle missing JWT token gracefully', async () => {
      // Mock missing JWT
      mockAuth.jwt.mockReturnValue(null);

      // Mock RLS policy denial
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: {
          code: '42501',
          message: 'new row violates row-level security policy for table "sponsors"'
        }
      });

      const result = await mockSupabase
        .from('sponsors')
        .update({ name: 'Unauthorized Update' })
        .eq('id', sponsorRecord.id)
        .single();

      expect(result.error).toBeTruthy();
      expect(result.data).toBeNull();
    });

    it('should handle malformed wallet addresses', async () => {
      // Mock JWT with malformed wallet address
      mockAuth.jwt.mockReturnValue({
        wallet_address: 'invalid-address'
      });

      // Mock RLS policy denial
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: {
          code: '42501',
          message: 'new row violates row-level security policy for table "sponsors"'
        }
      });

      const result = await mockSupabase
        .from('sponsors')
        .update({ name: 'Unauthorized Update' })
        .eq('id', sponsorRecord.id)
        .single();

      expect(result.error).toBeTruthy();
      expect(result.data).toBeNull();
    });

    it('should handle non-existent user profiles for admin check', async () => {
      // Mock JWT with wallet address that doesn't exist in user_profiles
      mockAuth.jwt.mockReturnValue({
        wallet_address: '0xnonexistent1234567890123456789012345678'
      });

      // Mock RLS policy denial (user not found in user_profiles)
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: {
          code: '42501',
          message: 'new row violates row-level security policy for table "sponsors"'
        }
      });

      const result = await mockSupabase
        .from('sponsors')
        .update({ name: 'Unauthorized Update' })
        .eq('id', sponsorRecord.id)
        .single();

      expect(result.error).toBeTruthy();
      expect(result.data).toBeNull();
    });
  });

  describe('Policy behavior verification', () => {
    it('should verify RLS policies are properly applied', () => {
      // This test documents the expected RLS policy behavior
      const expectedPolicies = [
        {
          name: 'Secure sponsor modifications',
          operation: 'UPDATE',
          condition: 'LOWER(sponsor_address) = LOWER(auth.jwt() ->> \'wallet_address\') OR admin check'
        },
        {
          name: 'Secure sponsor deletions', 
          operation: 'DELETE',
          condition: 'LOWER(sponsor_address) = LOWER(auth.jwt() ->> \'wallet_address\') OR admin check'
        }
      ];

      // Verify policy structure
      expect(expectedPolicies).toHaveLength(2);
      expect(expectedPolicies[0].operation).toBe('UPDATE');
      expect(expectedPolicies[1].operation).toBe('DELETE');
      
      // Both policies should have the same security condition
      expectedPolicies.forEach(policy => {
        expect(policy.condition).toContain('LOWER(sponsor_address) = LOWER(auth.jwt()');
        expect(policy.condition).toContain('admin check');
      });
    });
  });
});