import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST() {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return json({ 
        success: false, 
        error: 'Missing Supabase configuration' 
      }, { status: 500 });
    }

    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Call the refresh function
    const { data, error } = await supabase.rpc('refresh_all_player_stats');

    if (error) {
      console.error('Error refreshing player stats:', error);
      return json({ 
        success: false, 
        error: error.message 
      }, { status: 500 });
    }

    return json({ 
      success: true, 
      updated_count: data,
      message: `Successfully updated ${data} player records` 
    });

  } catch (error) {
    console.error('Error in refresh-player-stats API:', error);
    return json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}