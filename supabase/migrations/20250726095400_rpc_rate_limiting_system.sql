-- Migration: RPC Rate Limiting System
-- Description: Add tables to track RPC provider health, rate limiting metrics, and performance

-- Create RPC providers table to track provider configurations
CREATE TABLE IF NOT EXISTS rpc_providers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    rpc_url TEXT NOT NULL,
    chain_id INTEGER NOT NULL,
    priority INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    max_requests_per_second INTEGER DEFAULT 10,
    max_concurrent_requests INTEGER DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create RPC provider health tracking table
CREATE TABLE IF NOT EXISTS rpc_provider_health (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    provider_id UUID REFERENCES rpc_providers(id) ON DELETE CASCADE,
    is_healthy BOOLEAN DEFAULT true,
    failure_count INTEGER DEFAULT 0,
    last_failure_at TIMESTAMP WITH TIME ZONE,
    last_success_at TIMESTAMP WITH TIME ZONE,
    response_time_ms INTEGER,
    error_message TEXT,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create RPC request metrics table for monitoring
CREATE TABLE IF NOT EXISTS rpc_request_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    provider_id UUID REFERENCES rpc_providers(id) ON DELETE CASCADE,
    method TEXT NOT NULL,
    success BOOLEAN NOT NULL,
    response_time_ms INTEGER,
    error_type TEXT,
    error_message TEXT,
    cached BOOLEAN DEFAULT false,
    batch_size INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create rate limiting events table
CREATE TABLE IF NOT EXISTS rpc_rate_limit_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    provider_id UUID REFERENCES rpc_providers(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('rate_limited', 'retry', 'fallback', 'cache_hit', 'cache_miss')),
    method TEXT,
    delay_ms INTEGER,
    attempt_number INTEGER,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default RPC providers
INSERT INTO rpc_providers (name, rpc_url, chain_id, priority, max_requests_per_second, max_concurrent_requests) VALUES
    ('Primary-Infura', 'https://sepolia.infura.io/v3/9ffe04da38034641bbbaa5883cec1a01', 11155111, 10, 8, 3),
    ('Alchemy-Sepolia', 'https://eth-sepolia.g.alchemy.com/v2/demo', 11155111, 8, 10, 5),
    ('Ankr-Sepolia', 'https://rpc.ankr.com/eth_sepolia', 11155111, 6, 15, 5),
    ('Public-Sepolia', 'https://sepolia.drpc.org', 11155111, 4, 5, 3)
ON CONFLICT (name) DO UPDATE SET
    rpc_url = EXCLUDED.rpc_url,
    priority = EXCLUDED.priority,
    max_requests_per_second = EXCLUDED.max_requests_per_second,
    max_concurrent_requests = EXCLUDED.max_concurrent_requests,
    updated_at = NOW();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rpc_provider_health_provider_id ON rpc_provider_health(provider_id);
CREATE INDEX IF NOT EXISTS idx_rpc_provider_health_checked_at ON rpc_provider_health(checked_at);
CREATE INDEX IF NOT EXISTS idx_rpc_request_metrics_provider_id ON rpc_request_metrics(provider_id);
CREATE INDEX IF NOT EXISTS idx_rpc_request_metrics_created_at ON rpc_request_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_rpc_request_metrics_method ON rpc_request_metrics(method);
CREATE INDEX IF NOT EXISTS idx_rpc_rate_limit_events_provider_id ON rpc_rate_limit_events(provider_id);
CREATE INDEX IF NOT EXISTS idx_rpc_rate_limit_events_created_at ON rpc_rate_limit_events(created_at);
CREATE INDEX IF NOT EXISTS idx_rpc_rate_limit_events_event_type ON rpc_rate_limit_events(event_type);

-- Create function to update provider health
CREATE OR REPLACE FUNCTION update_rpc_provider_health(
    p_provider_id UUID,
    p_is_healthy BOOLEAN,
    p_response_time_ms INTEGER DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO rpc_provider_health (
        provider_id,
        is_healthy,
        failure_count,
        last_failure_at,
        last_success_at,
        response_time_ms,
        error_message,
        checked_at
    ) VALUES (
        p_provider_id,
        p_is_healthy,
        CASE WHEN p_is_healthy THEN 0 ELSE 1 END,
        CASE WHEN p_is_healthy THEN NULL ELSE NOW() END,
        CASE WHEN p_is_healthy THEN NOW() ELSE NULL END,
        p_response_time_ms,
        p_error_message,
        NOW()
    )
    ON CONFLICT (provider_id) DO UPDATE SET
        is_healthy = EXCLUDED.is_healthy,
        failure_count = CASE 
            WHEN EXCLUDED.is_healthy THEN 0 
            ELSE rpc_provider_health.failure_count + 1 
        END,
        last_failure_at = CASE 
            WHEN EXCLUDED.is_healthy THEN rpc_provider_health.last_failure_at 
            ELSE EXCLUDED.last_failure_at 
        END,
        last_success_at = CASE 
            WHEN EXCLUDED.is_healthy THEN EXCLUDED.last_success_at 
            ELSE rpc_provider_health.last_success_at 
        END,
        response_time_ms = EXCLUDED.response_time_ms,
        error_message = EXCLUDED.error_message,
        checked_at = EXCLUDED.checked_at;
END;
$$ LANGUAGE plpgsql;

-- Create function to log RPC request metrics
CREATE OR REPLACE FUNCTION log_rpc_request_metric(
    p_provider_id UUID,
    p_method TEXT,
    p_success BOOLEAN,
    p_response_time_ms INTEGER DEFAULT NULL,
    p_error_type TEXT DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL,
    p_cached BOOLEAN DEFAULT false,
    p_batch_size INTEGER DEFAULT 1
) RETURNS VOID AS $$
BEGIN
    INSERT INTO rpc_request_metrics (
        provider_id,
        method,
        success,
        response_time_ms,
        error_type,
        error_message,
        cached,
        batch_size,
        created_at
    ) VALUES (
        p_provider_id,
        p_method,
        p_success,
        p_response_time_ms,
        p_error_type,
        p_error_message,
        p_cached,
        p_batch_size,
        NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- Create function to log rate limiting events
CREATE OR REPLACE FUNCTION log_rpc_rate_limit_event(
    p_provider_id UUID,
    p_event_type TEXT,
    p_method TEXT DEFAULT NULL,
    p_delay_ms INTEGER DEFAULT NULL,
    p_attempt_number INTEGER DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO rpc_rate_limit_events (
        provider_id,
        event_type,
        method,
        delay_ms,
        attempt_number,
        metadata,
        created_at
    ) VALUES (
        p_provider_id,
        p_event_type,
        p_method,
        p_delay_ms,
        p_attempt_number,
        p_metadata,
        NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- Create view for RPC provider statistics
CREATE OR REPLACE VIEW rpc_provider_stats AS
SELECT 
    p.id,
    p.name,
    p.rpc_url,
    p.chain_id,
    p.priority,
    p.is_active,
    h.is_healthy,
    h.failure_count,
    h.last_failure_at,
    h.last_success_at,
    h.response_time_ms,
    h.checked_at,
    -- Request metrics for last 24 hours
    COALESCE(m24h.total_requests, 0) as requests_24h,
    COALESCE(m24h.successful_requests, 0) as successful_requests_24h,
    COALESCE(m24h.failed_requests, 0) as failed_requests_24h,
    COALESCE(m24h.avg_response_time, 0) as avg_response_time_24h,
    COALESCE(m24h.cache_hit_rate, 0) as cache_hit_rate_24h
FROM rpc_providers p
LEFT JOIN rpc_provider_health h ON p.id = h.provider_id
LEFT JOIN (
    SELECT 
        provider_id,
        COUNT(*) as total_requests,
        COUNT(*) FILTER (WHERE success = true) as successful_requests,
        COUNT(*) FILTER (WHERE success = false) as failed_requests,
        AVG(response_time_ms) FILTER (WHERE response_time_ms IS NOT NULL) as avg_response_time,
        (COUNT(*) FILTER (WHERE cached = true)::FLOAT / COUNT(*)) * 100 as cache_hit_rate
    FROM rpc_request_metrics 
    WHERE created_at > NOW() - INTERVAL '24 hours'
    GROUP BY provider_id
) m24h ON p.id = m24h.provider_id;

-- Create function to get healthy providers
CREATE OR REPLACE FUNCTION get_healthy_rpc_providers(p_chain_id INTEGER DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    name TEXT,
    rpc_url TEXT,
    chain_id INTEGER,
    priority INTEGER,
    max_requests_per_second INTEGER,
    max_concurrent_requests INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.rpc_url,
        p.chain_id,
        p.priority,
        p.max_requests_per_second,
        p.max_concurrent_requests
    FROM rpc_providers p
    LEFT JOIN rpc_provider_health h ON p.id = h.provider_id
    WHERE p.is_active = true
    AND (p_chain_id IS NULL OR p.chain_id = p_chain_id)
    AND (h.is_healthy IS NULL OR h.is_healthy = true)
    ORDER BY p.priority DESC, p.name;
END;
$$ LANGUAGE plpgsql;

-- Create function to cleanup old metrics (keep last 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_rpc_metrics()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete old request metrics (older than 7 days)
    DELETE FROM rpc_request_metrics 
    WHERE created_at < NOW() - INTERVAL '7 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Delete old rate limit events (older than 7 days)
    DELETE FROM rpc_rate_limit_events 
    WHERE created_at < NOW() - INTERVAL '7 days';
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS (Row Level Security) for the tables
ALTER TABLE rpc_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpc_provider_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpc_request_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpc_rate_limit_events ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (these are monitoring tables)
CREATE POLICY "Allow public read access to rpc_providers" ON rpc_providers FOR SELECT USING (true);
CREATE POLICY "Allow public read access to rpc_provider_health" ON rpc_provider_health FOR SELECT USING (true);
CREATE POLICY "Allow public read access to rpc_request_metrics" ON rpc_request_metrics FOR SELECT USING (true);
CREATE POLICY "Allow public read access to rpc_rate_limit_events" ON rpc_rate_limit_events FOR SELECT USING (true);

-- Create policies for service role to insert/update
CREATE POLICY "Allow service role to manage rpc_providers" ON rpc_providers FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role to manage rpc_provider_health" ON rpc_provider_health FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role to manage rpc_request_metrics" ON rpc_request_metrics FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role to manage rpc_rate_limit_events" ON rpc_rate_limit_events FOR ALL USING (auth.role() = 'service_role');

-- Grant necessary permissions
GRANT SELECT ON rpc_providers TO anon, authenticated;
GRANT SELECT ON rpc_provider_health TO anon, authenticated;
GRANT SELECT ON rpc_request_metrics TO anon, authenticated;
GRANT SELECT ON rpc_rate_limit_events TO anon, authenticated;
GRANT SELECT ON rpc_provider_stats TO anon, authenticated;

GRANT ALL ON rpc_providers TO service_role;
GRANT ALL ON rpc_provider_health TO service_role;
GRANT ALL ON rpc_request_metrics TO service_role;
GRANT ALL ON rpc_rate_limit_events TO service_role;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION update_rpc_provider_health TO service_role;
GRANT EXECUTE ON FUNCTION log_rpc_request_metric TO service_role;
GRANT EXECUTE ON FUNCTION log_rpc_rate_limit_event TO service_role;
GRANT EXECUTE ON FUNCTION get_healthy_rpc_providers TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_rpc_metrics TO service_role;

-- Add comments for documentation
COMMENT ON TABLE rpc_providers IS 'Configuration for RPC providers with rate limiting settings';
COMMENT ON TABLE rpc_provider_health IS 'Health status tracking for RPC providers';
COMMENT ON TABLE rpc_request_metrics IS 'Metrics for individual RPC requests';
COMMENT ON TABLE rpc_rate_limit_events IS 'Events related to rate limiting, retries, and fallbacks';
COMMENT ON VIEW rpc_provider_stats IS 'Aggregated statistics for RPC providers';
COMMENT ON FUNCTION update_rpc_provider_health IS 'Update health status for an RPC provider';
COMMENT ON FUNCTION log_rpc_request_metric IS 'Log metrics for an RPC request';
COMMENT ON FUNCTION log_rpc_rate_limit_event IS 'Log rate limiting related events';
COMMENT ON FUNCTION get_healthy_rpc_providers IS 'Get list of healthy RPC providers for a chain';
COMMENT ON FUNCTION cleanup_old_rpc_metrics IS 'Clean up old metrics data to prevent table bloat';