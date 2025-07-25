-- =============================================================================
-- FIX REFERRAL STATS FUNCTION FOR WALLET-BASED SYSTEM
-- =============================================================================
-- This migration fixes the get_referral_stats function to work properly with
-- wallet addresses instead of trying to map to Supabase Auth user IDs.

-- Update the get_referral_stats function to work with wallet addresses directly
CREATE OR REPLACE FUNCTION get_referral_stats(player_addr VARCHAR(42))
RETURNS JSON AS $$
DECLARE
    stats JSON;
BEGIN
    SELECT json_build_object(
        'referral_code', (
            SELECT code 
            FROM referral_codes 
            WHERE referrer_address = player_addr 
            AND is_active = true 
            LIMIT 1
        ),
        'total_referrals', (
            SELECT COUNT(*) 
            FROM referrals 
            WHERE referrer_address = player_addr
        ),
        'successful_referrals', (
            SELECT COUNT(*) 
            FROM referrals 
            WHERE referrer_address = player_addr 
            AND first_shot_at IS NOT NULL
        ),
        'available_discounts', (
            -- For now, return 0 since we need to implement wallet-based discounts
            -- or map wallet addresses to user IDs properly
            SELECT 0
        ),
        'total_discounts_earned', (
            -- For now, return 0 since we need to implement wallet-based discounts
            -- or map wallet addresses to user IDs properly
            SELECT 0
        ),
        'referred_by', (
            SELECT referrer_address
            FROM referrals
            WHERE referee_address = player_addr
            LIMIT 1
        )
    ) INTO stats;
    
    RETURN stats;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_referral_stats TO authenticated;

-- =============================================================================
-- MIGRATION NOTES
-- =============================================================================
-- This migration:
-- 1. Fixes the get_referral_stats function to work with wallet addresses
-- 2. Temporarily returns 0 for discount counts until we implement proper
--    wallet-to-user mapping or redesign the discount system for wallets
-- 3. Ensures the referral code widget will appear when a wallet connects
-- 4. Maintains compatibility with the existing wallet-based referral system