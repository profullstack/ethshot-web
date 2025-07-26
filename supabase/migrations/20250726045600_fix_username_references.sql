-- Migration: Fix Username References in User Profile Statistics
-- Created: 2025-07-26 04:56:00 UTC
-- Description: Removes deprecated username field references from user profile statistics functions

-- Update get_user_statistics function to remove username references
CREATE OR REPLACE FUNCTION get_user_statistics(wallet_addr TEXT)
RETURNS JSON AS $$
DECLARE
    user_stats JSON;
    profile_data RECORD;
    player_data RECORD;
    referral_data JSON;
    recent_activity JSON[];
    win_streak INTEGER;
    biggest_win DECIMAL(20, 18);
    total_referrals INTEGER;
    successful_referrals INTEGER;
BEGIN
    -- Get user profile
    SELECT * INTO profile_data
    FROM user_profiles
    WHERE wallet_address = LOWER(wallet_addr);
    
    -- Get player statistics
    SELECT * INTO player_data
    FROM players
    WHERE address = LOWER(wallet_addr);
    
    -- Get referral statistics
    SELECT get_referral_stats(LOWER(wallet_addr)) INTO referral_data;
    
    -- Calculate win streak (consecutive wins from recent shots)
    WITH recent_shots AS (
        SELECT won, ROW_NUMBER() OVER (ORDER BY timestamp DESC) as rn
        FROM shots
        WHERE player_address = LOWER(wallet_addr)
        ORDER BY timestamp DESC
        LIMIT 50
    ),
    streak_calc AS (
        SELECT 
            CASE 
                WHEN won THEN 0
                ELSE ROW_NUMBER() OVER (ORDER BY rn)
            END as streak_break
        FROM recent_shots
        WHERE rn <= (SELECT MIN(rn) FROM recent_shots WHERE NOT won)
    )
    SELECT COALESCE(MIN(streak_break) - 1, 0) INTO win_streak
    FROM streak_calc;
    
    -- Get biggest single win
    SELECT COALESCE(MAX(amount), 0) INTO biggest_win
    FROM winners
    WHERE winner_address = LOWER(wallet_addr);
    
    -- Get recent activity (last 10 activities)
    SELECT array_agg(
        json_build_object(
            'type', activity_type,
            'amount', amount,
            'won', won,
            'timestamp', timestamp,
            'tx_hash', tx_hash
        ) ORDER BY timestamp DESC
    ) INTO recent_activity
    FROM (
        SELECT 
            'shot' as activity_type,
            amount,
            won,
            timestamp,
            tx_hash
        FROM shots
        WHERE player_address = LOWER(wallet_addr)
        UNION ALL
        SELECT 
            'win' as activity_type,
            amount,
            true as won,
            timestamp,
            tx_hash
        FROM winners
        WHERE winner_address = LOWER(wallet_addr)
        ORDER BY timestamp DESC
        LIMIT 10
    ) activities;
    
    -- Get referral counts
    SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN first_shot_at IS NOT NULL THEN 1 END) as successful
    INTO total_referrals, successful_referrals
    FROM referrals
    WHERE referrer_address = LOWER(wallet_addr);
    
    -- Build comprehensive statistics object (removed username field)
    SELECT json_build_object(
        'profile', json_build_object(
            'id', profile_data.id,
            'wallet_address', profile_data.wallet_address,
            'nickname', profile_data.nickname,
            'avatar_url', profile_data.avatar_url,
            'bio', profile_data.bio,
            'created_at', profile_data.created_at,
            'updated_at', profile_data.updated_at
        ),
        'game_stats', json_build_object(
            'total_shots', COALESCE(player_data.total_shots, 0),
            'total_spent', COALESCE(player_data.total_spent, 0),
            'total_won', COALESCE(player_data.total_won, 0),
            'biggest_win', biggest_win,
            'win_rate', CASE 
                WHEN COALESCE(player_data.total_shots, 0) > 0 
                THEN ROUND((SELECT COUNT(*) FROM shots WHERE player_address = LOWER(wallet_addr) AND won = true)::DECIMAL / player_data.total_shots * 100, 2)
                ELSE 0 
            END,
            'roi_percentage', CASE 
                WHEN COALESCE(player_data.total_spent, 0) > 0 
                THEN ROUND((COALESCE(player_data.total_won, 0) / player_data.total_spent) * 100, 2)
                ELSE 0 
            END,
            'current_win_streak', win_streak,
            'last_shot_time', player_data.last_shot_time,
            'shots_rank', get_player_rank(LOWER(wallet_addr), 'total_shots'),
            'winnings_rank', get_player_rank(LOWER(wallet_addr), 'total_won')
        ),
        'referral_stats', json_build_object(
            'referral_code', referral_data->>'referral_code',
            'total_referrals', total_referrals,
            'successful_referrals', successful_referrals,
            'bonus_shots_available', (referral_data->>'bonus_shots_available')::INTEGER,
            'total_bonus_shots_earned', (referral_data->>'total_bonus_shots_earned')::INTEGER,
            'referred_by', referral_data->>'referred_by'
        ),
        'recent_activity', COALESCE(recent_activity, '[]'::JSON[]),
        'achievements', json_build_object(
            'first_shot', CASE WHEN player_data.total_shots > 0 THEN true ELSE false END,
            'big_spender', CASE WHEN COALESCE(player_data.total_spent, 0) >= 1 THEN true ELSE false END,
            'winner', CASE WHEN biggest_win > 0 THEN true ELSE false END,
            'referrer', CASE WHEN total_referrals > 0 THEN true ELSE false END,
            'veteran', CASE WHEN COALESCE(player_data.total_shots, 0) >= 100 THEN true ELSE false END
        )
    ) INTO user_stats;
    
    RETURN user_stats;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON FUNCTION get_user_statistics(TEXT) IS 'Gets comprehensive user statistics including profile, game stats, referrals, and achievements (updated to remove deprecated username field)';