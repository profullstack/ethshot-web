-- =============================================================================
-- FIX REFERRAL SIGNUP FUNCTION FOR WALLET ADDRESSES
-- =============================================================================
-- This migration fixes the process_referral_signup function to properly
-- handle wallet addresses instead of UUIDs, ensuring referral processing works.

-- Drop the existing function with the problematic signature
DROP FUNCTION IF EXISTS process_referral_signup(VARCHAR, UUID);

-- Create the corrected function that accepts wallet addresses
CREATE OR REPLACE FUNCTION process_referral_signup(
    ref_code VARCHAR(20),
    referee_addr VARCHAR(42)
)
RETURNS BOOLEAN AS $$
DECLARE
    code_record RECORD;
    referral_id UUID;
BEGIN
    -- Find valid referral code
    SELECT * INTO code_record
    FROM referral_codes
    WHERE code = ref_code
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_uses IS NULL OR total_uses < max_uses)
    AND referrer_address != referee_addr; -- Can't refer yourself
    
    -- Return false if code not found or invalid
    IF code_record IS NULL THEN
        RETURN false;
    END IF;
    
    -- Check if referee already used a referral code
    IF EXISTS(SELECT 1 FROM referrals WHERE referee_address = referee_addr) THEN
        RETURN false;
    END IF;
    
    -- Create referral record
    INSERT INTO referrals (referral_code_id, referrer_address, referee_address)
    VALUES (code_record.id, code_record.referrer_address, referee_addr)
    RETURNING id INTO referral_id;
    
    -- Update referral code usage count
    UPDATE referral_codes 
    SET total_uses = total_uses + 1 
    WHERE id = code_record.id;
    
    -- Create discounts for both referrer and referee using the wallet-based system
    INSERT INTO referral_discounts (
        wallet_address,
        discount_type,
        discount_percentage,
        referral_id
    ) VALUES 
    (referee_addr, 'referee', 0.20, referral_id),
    (code_record.referrer_address, 'referrer', 0.20, referral_id);
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION process_referral_signup(VARCHAR, VARCHAR) TO authenticated, anon;

-- =============================================================================
-- MIGRATION NOTES
-- =============================================================================
-- This migration:
-- 1. Fixes the process_referral_signup function to accept wallet addresses
-- 2. Ensures referral processing creates proper discount records
-- 3. Maintains the original referral tracking logic
-- 4. Creates discounts directly instead of relying on separate functions
-- 5. Allows anonymous access for wallet-only authentication