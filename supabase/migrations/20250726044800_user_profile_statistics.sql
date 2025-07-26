-- Migration: User Profile Statistics Functions
-- Created: 2025-07-26 04:48:00 UTC
-- Description: Creates comprehensive functions to fetch user profile statistics for user profile pages

-- Function to get comprehensive user statistics
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
    
    -- Build comprehensive statistics object
    SELECT json_build_object(
        'profile', json_build_object(
            'id', profile_data.id,
            'wallet_address', profile_data.wallet_address,
            'nickname', profile_data.nickname,
            'username', profile_data.username,
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

-- Function to get user referrals with details
CREATE OR REPLACE FUNCTION get_user_referrals(wallet_addr TEXT)
RETURNS JSON AS $$
DECLARE
    referrals_data JSON;
BEGIN
    SELECT json_build_object(
        'referrals', COALESCE(json_agg(
            json_build_object(
                'referee_address', r.referee_address,
                'referee_profile', json_build_object(
                    'nickname', up.nickname,
                    'avatar_url', up.avatar_url
                ),
                'created_at', r.created_at,
                'first_shot_at', r.first_shot_at,
                'is_active', CASE WHEN r.first_shot_at IS NOT NULL THEN true ELSE false END,
                'bonus_claimed', r.referrer_bonus_claimed
            ) ORDER BY r.created_at DESC
        ), '[]'::JSON),
        'total_count', COUNT(*),
        'active_count', COUNT(CASE WHEN r.first_shot_at IS NOT NULL THEN 1 END)
    ) INTO referrals_data
    FROM referrals r
    LEFT JOIN user_profiles up ON up.wallet_address = r.referee_address
    WHERE r.referrer_address = LOWER(wallet_addr);
    
    RETURN referrals_data;
END;
$$ LANGUAGE plpgsql;

-- Function to get user's shot history with pagination
CREATE OR REPLACE FUNCTION get_user_shot_history(
    wallet_addr TEXT,
    page_limit INTEGER DEFAULT 20,
    page_offset INTEGER DEFAULT 0
)
RETURNS JSON AS $$
DECLARE
    shots_data JSON;
BEGIN
    SELECT json_build_object(
        'shots', COALESCE(json_agg(
            json_build_object(
                'id', s.id,
                'amount', s.amount,
                'won', s.won,
                'timestamp', s.timestamp,
                'tx_hash', s.tx_hash,
                'block_number', s.block_number
            ) ORDER BY s.timestamp DESC
        ), '[]'::JSON),
        'total_count', (
            SELECT COUNT(*) 
            FROM shots 
            WHERE player_address = LOWER(wallet_addr)
        ),
        'has_more', (
            SELECT COUNT(*) > (page_offset + page_limit)
            FROM shots 
            WHERE player_address = LOWER(wallet_addr)
        )
    ) INTO shots_data
    FROM (
        SELECT *
        FROM shots
        WHERE player_address = LOWER(wallet_addr)
        ORDER BY timestamp DESC
        LIMIT page_limit
        OFFSET page_offset
    ) s;
    
    RETURN shots_data;
END;
$$ LANGUAGE plpgsql;

-- Function to get user's wins history
CREATE OR REPLACE FUNCTION get_user_wins_history(wallet_addr TEXT)
RETURNS JSON AS $$
DECLARE
    wins_data JSON;
BEGIN
    SELECT json_build_object(
        'wins', COALESCE(json_agg(
            json_build_object(
                'id', w.id,
                'amount', w.amount,
                'timestamp', w.timestamp,
                'tx_hash', w.tx_hash,
                'block_number', w.block_number
            ) ORDER BY w.timestamp DESC
        ), '[]'::JSON),
        'total_count', COUNT(*),
        'total_amount', COALESCE(SUM(w.amount), 0)
    ) INTO wins_data
    FROM winners w
    WHERE w.winner_address = LOWER(wallet_addr);
    
    RETURN wins_data;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user exists (has profile or game activity)
CREATE OR REPLACE FUNCTION user_exists(wallet_addr TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    has_profile BOOLEAN;
    has_activity BOOLEAN;
BEGIN
    -- Check if user has a profile
    SELECT EXISTS(
        SELECT 1 FROM user_profiles 
        WHERE wallet_address = LOWER(wallet_addr)
    ) INTO has_profile;
    
    -- Check if user has any game activity
    SELECT EXISTS(
        SELECT 1 FROM players 
        WHERE address = LOWER(wallet_addr) AND total_shots > 0
    ) INTO has_activity;
    
    RETURN has_profile OR has_activity;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON FUNCTION get_user_statistics(TEXT) IS 'Gets comprehensive user statistics including profile, game stats, referrals, and achievements';
COMMENT ON FUNCTION get_user_referrals(TEXT) IS 'Gets detailed referral information for a user';
COMMENT ON FUNCTION get_user_shot_history(TEXT, INTEGER, INTEGER) IS 'Gets paginated shot history for a user';
COMMENT ON FUNCTION get_user_wins_history(TEXT) IS 'Gets complete wins history for a user';
COMMENT ON FUNCTION user_exists(TEXT) IS 'Checks if a user exists (has profile or game activity)';