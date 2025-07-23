-- ETH Shot Database Schema for Supabase
-- This file serves as a reference and documentation for the database structure
-- 
-- IMPORTANT: The actual database schema is managed through migrations in the ./migrations/ folder
-- To apply the schema, run the migration files in chronological order or use Supabase CLI
--
-- Migration files location: ./migrations/
-- Latest migration: 20250123051117_initial_schema.sql
--
-- For development setup:
-- 1. Use `supabase db reset` to apply all migrations from scratch
-- 2. Use `supabase db push` to apply pending migrations
-- 3. Use `supabase migration new feature_name` to create new migrations
--
-- This file is kept for reference and documentation purposes only.
-- DO NOT modify this file directly - create new migration files instead.

-- =============================================================================
-- CURRENT SCHEMA OVERVIEW (as of 20250123051117_initial_schema.sql)
-- =============================================================================

-- EXTENSIONS:
-- - uuid-ossp: For UUID generation

-- TABLES:
-- - players: Player statistics and information
-- - shots: Records every shot taken in the game
-- - winners: Records all jackpot wins
-- - sponsors: Records sponsor rounds and branding
-- - game_stats: Global game statistics and metrics

-- INDEXES:
-- - Performance indexes on frequently queried columns
-- - Unique indexes on transaction hashes and addresses

-- FUNCTIONS:
-- - update_updated_at_column(): Automatic timestamp updates
-- - get_player_rank(): Calculate player rankings
-- - update_game_statistics(): Update global game stats
-- - trigger_update_game_stats(): Trigger function for automatic stats updates

-- TRIGGERS:
-- - update_players_updated_at: Auto-update timestamps on players table
-- - shots_update_stats: Auto-update game stats when shots change
-- - winners_update_stats: Auto-update game stats when winners change
-- - players_update_stats: Auto-update game stats when players change

-- VIEWS:
-- - leaderboard_by_shots: Players ranked by total shots
-- - leaderboard_by_winnings: Players ranked by total winnings
-- - recent_activity: Combined view of recent shots and wins

-- ROW LEVEL SECURITY (RLS):
-- - All tables have RLS enabled
-- - Public read access for all tables (game is public)
-- - Public insert/update access for game operations

-- =============================================================================
-- MIGRATION HISTORY
-- =============================================================================

-- 20250123051117_initial_schema.sql
-- - Initial database schema setup
-- - Created all core tables, indexes, functions, triggers, and RLS policies
-- - Established foundation for ETH Shot game database

-- =============================================================================
-- DEVELOPMENT NOTES
-- =============================================================================

-- To add new features:
-- 1. Create a new migration file: supabase migration new feature_name
-- 2. Add your SQL changes to the new migration file
-- 3. Test the migration in development: supabase db reset
-- 4. Apply to staging/production: supabase db push

-- To view current schema:
-- 1. Check the latest migration files in ./migrations/
-- 2. Use Supabase dashboard to inspect live database
-- 3. Use `supabase db diff` to see pending changes

-- For schema documentation:
-- - See ./migrations/README.md for detailed migration documentation
-- - Each migration file contains comments explaining the changes
-- - Use database comments (COMMENT ON) for table/column documentation