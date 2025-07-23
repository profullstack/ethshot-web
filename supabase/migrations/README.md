# Supabase Migrations

This directory contains database migration files for the ETH Shot application. Migrations are used to version control database schema changes and ensure consistent database state across different environments.

## Migration File Naming Convention

Migration files follow the format: `YYYYMMDDHHMMSS_feature_name.sql`

- **YYYYMMDDHHMMSS**: Timestamp in UTC format (Year, Month, Day, Hour, Minute, Second)
- **feature_name**: Descriptive name of the feature or change being implemented

### Examples:
- `20250123051117_initial_schema.sql` - Initial database schema setup
- `20250123120000_add_user_preferences.sql` - Adding user preferences table
- `20250124080000_update_sponsors_table.sql` - Updating sponsors table structure

## Migration Files

### 20250123051117_initial_schema.sql
- **Created**: 2025-01-23 05:11:17 UTC
- **Description**: Initial database schema setup including all core tables, indexes, functions, triggers, and RLS policies
- **Tables Created**:
  - `players` - Player statistics and information
  - `shots` - Records of every shot taken
  - `winners` - Jackpot win records
  - `sponsors` - Sponsor information and branding
  - `game_stats` - Global game statistics
- **Features**:
  - Row Level Security (RLS) policies
  - Automatic timestamp triggers
  - Performance indexes
  - Database views for common queries
  - Helper functions for rankings and statistics

## Running Migrations

### Initial Setup (First Time Only)
```bash
# Link your local project to your Supabase cloud project
pnpm run db:link

# Or run the complete setup (link + migrate)
pnpm run db:setup
```

### Using pnpm Scripts (Recommended)
```bash
# Apply all pending migrations to your Supabase cloud database
pnpm run db:migrate

# Reset database and apply all migrations from scratch
pnpm run db:reset

# Create a new migration file with timestamp
pnpm run db:migration:new feature_name

# Check migration status and see which migrations have been applied
pnpm run db:status

# Generate a diff of pending changes
pnpm run db:diff

# Link project to Supabase (automatically reads project ref from .env file)
pnpm run db:link
```

### Using Supabase CLI Directly
```bash
# First, link your project (one time setup) - replace with your actual project ref
supabase link --project-ref oalbonsiquulspxoimqp

# Apply all pending migrations
supabase db push --linked

# Reset database and apply all migrations
supabase db reset --linked

# Generate a new migration
supabase migration new feature_name

# List migration status
supabase migration list --linked
```

### Manual Application
Migrations can be applied manually by running the SQL files in chronological order (by timestamp) against your Supabase database.

## Best Practices

1. **Always use timestamps**: Ensure migration files have proper timestamps to maintain order
2. **Descriptive names**: Use clear, descriptive names for migration files
3. **Idempotent operations**: Use `IF NOT EXISTS` and similar constructs to make migrations safe to run multiple times
4. **Test migrations**: Always test migrations on a development database first
5. **Backup before production**: Always backup production data before applying migrations
6. **One feature per migration**: Keep migrations focused on a single feature or change
7. **Document changes**: Include comments in migration files explaining the purpose and impact

## Migration Structure

Each migration file should include:

```sql
-- Migration: Brief description
-- Created: YYYY-MM-DD HH:MM:SS UTC
-- Description: Detailed description of changes

-- Your SQL statements here
```

## Rollback Strategy

While Supabase doesn't have built-in rollback functionality, you can create reverse migrations:
- For each migration, consider creating a corresponding rollback migration
- Name rollback migrations with `rollback_` prefix: `20250123120000_rollback_add_user_preferences.sql`
- Test rollback procedures in development environments

## Environment Considerations

- **Development**: Use `supabase db reset` to start fresh when needed
- **Staging**: Apply migrations incrementally and test thoroughly
- **Production**: Apply migrations during maintenance windows with proper backups

## Troubleshooting

### Common Issues:
1. **Migration order**: Ensure migrations are applied in chronological order
2. **Dependency conflicts**: Check for table/column dependencies before dropping
3. **Data migration**: Consider data migration needs when changing table structures
4. **Permission issues**: Ensure proper database permissions for migration execution

### Recovery:
- If a migration fails, check the error logs
- Fix the issue in the migration file
- Reset development database and reapply all migrations
- For production issues, consider manual fixes or rollback procedures