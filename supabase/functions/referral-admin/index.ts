import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('[referral-admin] Incoming request:', req.method, req.url);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    console.log('[referral-admin] Calling get_referral_admin_stats RPC');
    const { data: stats, error } = await supabase.rpc('get_referral_admin_stats');

    if (error) {
      console.error('[referral-admin] RPC error:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log('[referral-admin] ✅ Stats fetched successfully');
    return new Response(
      JSON.stringify(stats),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[referral-admin] Unhandled error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
