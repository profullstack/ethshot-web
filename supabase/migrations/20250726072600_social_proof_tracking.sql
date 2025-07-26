-- Social Proof Tracking Migration
-- Adds tables and functions to track user activity for social proof features

-- Create social_activity table to track user actions for social proof
CREATE TABLE IF NOT EXISTS social_activity (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_address TEXT NOT NULL,
    activity_type TEXT NOT NULL CHECK (activity_type IN (
        'shot_taken', 'winner', 'big_shot', 'streak', 'milestone', 'trending', 'login', 'chat_message'
    )),
    activity_data JSONB DEFAULT '{}',
    intensity TEXT DEFAULT 'normal' CHECK (intensity IN ('low', 'normal', 'medium', 'high', 'extreme')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_social_activity_created_at ON social_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_activity_user_address ON social_activity(user_address);
CREATE INDEX IF NOT EXISTS idx_social_activity_type ON social_activity(activity_type);
CREATE INDEX IF NOT EXISTS idx_social_activity_expires_at ON social_activity(expires_at);

-- Create active_users table to track currently active users
CREATE TABLE IF NOT EXISTS active_users (
    user_address TEXT PRIMARY KEY,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    activity_count INTEGER DEFAULT 1,
    session_start TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_active_users_last_activity ON active_users(last_activity DESC);

-- Create pot_growth_tracking table to monitor pot changes
CREATE TABLE IF NOT EXISTS pot_growth_tracking (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pot_amount DECIMAL(20, 8) NOT NULL,
    growth_amount DECIMAL(20, 8) DEFAULT 0,
    growth_rate DECIMAL(10, 8) DEFAULT 0,
    milestone_reached INTEGER DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_pot_growth_created_at ON pot_growth_tracking(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pot_growth_milestone ON pot_growth_tracking(milestone_reached);

-- Create social_metrics table for aggregated statistics
CREATE TABLE IF NOT EXISTS social_metrics (
    id INTEGER PRIMARY KEY DEFAULT 1,
    total_players_today INTEGER DEFAULT 0,
    shots_in_last_hour INTEGER DEFAULT 0,
    peak_concurrent_users INTEGER DEFAULT 0,
    average_pot_growth DECIMAL(10, 8) DEFAULT 0,
    last_big_win JSONB DEFAULT NULL,
    trending_moment JSONB DEFAULT NULL,
    last_milestone INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT single_row CHECK (id = 1)
);

-- Insert initial row
INSERT INTO social_metrics (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Function to track user activity
CREATE OR REPLACE FUNCTION track_user_activity(
    p_user_address TEXT,
    p_activity_type TEXT,
    p_activity_data JSONB DEFAULT '{}',
    p_intensity TEXT DEFAULT 'normal'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    activity_id UUID;
BEGIN
    -- Insert activity record
    INSERT INTO social_activity (
        user_address,
        activity_type,
        activity_data,
        intensity
    ) VALUES (
        LOWER(p_user_address),
        p_activity_type,
        p_activity_data,
        p_intensity
    ) RETURNING id INTO activity_id;

    -- Update active users
    INSERT INTO active_users (user_address, last_activity, activity_count)
    VALUES (LOWER(p_user_address), NOW(), 1)
    ON CONFLICT (user_address) 
    DO UPDATE SET 
        last_activity = NOW(),
        activity_count = active_users.activity_count + 1;

    -- Update social metrics based on activity type
    IF p_activity_type = 'shot_taken' THEN
        UPDATE social_metrics 
        SET 
            shots_in_last_hour = shots_in_last_hour + 1,
            updated_at = NOW()
        WHERE id = 1;
    END IF;

    RETURN activity_id;
END;
$$;

-- Function to get recent social activity
CREATE OR REPLACE FUNCTION get_recent_social_activity(
    p_limit INTEGER DEFAULT 50,
    p_activity_types TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    user_address TEXT,
    activity_type TEXT,
    activity_data JSONB,
    intensity TEXT,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sa.id,
        sa.user_address,
        sa.activity_type,
        sa.activity_data,
        sa.intensity,
        sa.created_at
    FROM social_activity sa
    WHERE 
        sa.expires_at > NOW()
        AND (p_activity_types IS NULL OR sa.activity_type = ANY(p_activity_types))
    ORDER BY sa.created_at DESC
    LIMIT p_limit;
END;
$$;

-- Function to get active user count
CREATE OR REPLACE FUNCTION get_active_user_count(
    p_timeout_minutes INTEGER DEFAULT 5
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_count INTEGER;
BEGIN
    -- Count users active within timeout period
    SELECT COUNT(*)
    INTO user_count
    FROM active_users
    WHERE last_activity > (NOW() - INTERVAL '1 minute' * p_timeout_minutes);

    RETURN COALESCE(user_count, 0);
END;
$$;

-- Function to track pot growth
CREATE OR REPLACE FUNCTION track_pot_growth(
    p_pot_amount DECIMAL(20, 8),
    p_previous_amount DECIMAL(20, 8) DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    growth_id UUID;
    growth_amount DECIMAL(20, 8) := 0;
    growth_rate DECIMAL(10, 8) := 0;
    milestone_reached INTEGER := NULL;
    milestones INTEGER[] := ARRAY[1, 2, 5, 10, 20, 50, 100];
    milestone INTEGER;
BEGIN
    -- Calculate growth if previous amount provided
    IF p_previous_amount IS NOT NULL THEN
        growth_amount := p_pot_amount - p_previous_amount;
        
        -- Calculate growth rate (per minute)
        IF growth_amount > 0 THEN
            growth_rate := growth_amount / 1.0; -- Assuming 1 minute interval
        END IF;
    END IF;

    -- Check for milestone
    FOREACH milestone IN ARRAY milestones
    LOOP
        IF p_pot_amount >= milestone AND (p_previous_amount IS NULL OR p_previous_amount < milestone) THEN
            milestone_reached := milestone;
            EXIT;
        END IF;
    END LOOP;

    -- Insert tracking record
    INSERT INTO pot_growth_tracking (
        pot_amount,
        growth_amount,
        growth_rate,
        milestone_reached
    ) VALUES (
        p_pot_amount,
        growth_amount,
        growth_rate,
        milestone_reached
    ) RETURNING id INTO growth_id;

    -- Update social metrics if milestone reached
    IF milestone_reached IS NOT NULL THEN
        UPDATE social_metrics 
        SET 
            last_milestone = milestone_reached,
            updated_at = NOW()
        WHERE id = 1;

        -- Track milestone activity
        PERFORM track_user_activity(
            'system',
            'milestone',
            jsonb_build_object('milestone', milestone_reached, 'pot_amount', p_pot_amount),
            'high'
        );
    END IF;

    RETURN growth_id;
END;
$$;

-- Function to update social metrics
CREATE OR REPLACE FUNCTION update_social_metrics(
    p_metrics JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE social_metrics 
    SET 
        total_players_today = COALESCE((p_metrics->>'total_players_today')::INTEGER, total_players_today),
        shots_in_last_hour = COALESCE((p_metrics->>'shots_in_last_hour')::INTEGER, shots_in_last_hour),
        peak_concurrent_users = COALESCE((p_metrics->>'peak_concurrent_users')::INTEGER, peak_concurrent_users),
        average_pot_growth = COALESCE((p_metrics->>'average_pot_growth')::DECIMAL, average_pot_growth),
        last_big_win = COALESCE(p_metrics->'last_big_win', last_big_win),
        trending_moment = COALESCE(p_metrics->'trending_moment', trending_moment),
        updated_at = NOW()
    WHERE id = 1;
END;
$$;

-- Function to cleanup old activity records
CREATE OR REPLACE FUNCTION cleanup_social_activity()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete expired activity records
    DELETE FROM social_activity 
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    -- Cleanup old active users (inactive for more than 1 hour)
    DELETE FROM active_users 
    WHERE last_activity < (NOW() - INTERVAL '1 hour');

    -- Cleanup old pot growth records (keep last 1000)
    DELETE FROM pot_growth_tracking 
    WHERE id NOT IN (
        SELECT id 
        FROM pot_growth_tracking 
        ORDER BY created_at DESC 
        LIMIT 1000
    );

    RETURN deleted_count;
END;
$$;

-- Create RLS policies
ALTER TABLE social_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE pot_growth_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_metrics ENABLE ROW LEVEL SECURITY;

-- Allow read access to social activity
CREATE POLICY "Allow read access to social activity" ON social_activity
    FOR SELECT USING (true);

-- Allow read access to active users count
CREATE POLICY "Allow read access to active users" ON active_users
    FOR SELECT USING (true);

-- Allow read access to pot growth tracking
CREATE POLICY "Allow read access to pot growth" ON pot_growth_tracking
    FOR SELECT USING (true);

-- Allow read access to social metrics
CREATE POLICY "Allow read access to social metrics" ON social_metrics
    FOR SELECT USING (true);

-- Allow insert for tracking functions (service role only)
CREATE POLICY "Allow insert for service role" ON social_activity
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow insert for service role" ON active_users
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update for service role" ON active_users
    FOR UPDATE USING (true);

CREATE POLICY "Allow insert for service role" ON pot_growth_tracking
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update for service role" ON social_metrics
    FOR UPDATE USING (true);

-- Create a scheduled job to cleanup old records (if pg_cron is available)
-- This will run every hour to clean up expired records
-- SELECT cron.schedule('cleanup-social-activity', '0 * * * *', 'SELECT cleanup_social_activity();');

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON social_activity TO anon, authenticated;
GRANT SELECT ON active_users TO anon, authenticated;
GRANT SELECT ON pot_growth_tracking TO anon, authenticated;
GRANT SELECT ON social_metrics TO anon, authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION track_user_activity TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_recent_social_activity TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_active_user_count TO anon, authenticated;
GRANT EXECUTE ON FUNCTION track_pot_growth TO anon, authenticated;
GRANT EXECUTE ON FUNCTION update_social_metrics TO anon, authenticated;
GRANT EXECUTE ON FUNCTION cleanup_social_activity TO anon, authenticated;

-- Add comments for documentation
COMMENT ON TABLE social_activity IS 'Tracks user activities for social proof features';
COMMENT ON TABLE active_users IS 'Tracks currently active users for crowd pressure indicators';
COMMENT ON TABLE pot_growth_tracking IS 'Monitors pot growth for FOMO mechanics';
COMMENT ON TABLE social_metrics IS 'Aggregated social proof metrics and statistics';

COMMENT ON FUNCTION track_user_activity IS 'Records user activity for social proof tracking';
COMMENT ON FUNCTION get_recent_social_activity IS 'Retrieves recent social activities for live feed';
COMMENT ON FUNCTION get_active_user_count IS 'Returns count of currently active users';
COMMENT ON FUNCTION track_pot_growth IS 'Tracks pot growth and detects milestones';
COMMENT ON FUNCTION update_social_metrics IS 'Updates aggregated social metrics';
COMMENT ON FUNCTION cleanup_social_activity IS 'Cleans up expired activity records';