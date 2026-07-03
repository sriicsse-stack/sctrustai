import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Upsert profile and optionally fetch referral dashboard data
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { user_id, email, name, picture, fetch_dashboard } = await req.json();

    if (!user_id || !email) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: user_id, email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Upsert profile
    const { data: profile, error: profileErr } = await supabase.rpc('upsert_profile', {
      p_id: user_id,
      p_email: email,
      p_name: name || '',
      p_picture: picture || '',
    });

    if (profileErr) {
      console.error('upsert_profile error:', profileErr);
      return new Response(
        JSON.stringify({ error: profileErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!fetch_dashboard) {
      return new Response(
        JSON.stringify({ profile }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Also fetch dashboard
    const { data: dashboard, error: dashErr } = await supabase.rpc('get_referral_dashboard', {
      p_user_id: user_id,
    });

    if (dashErr) {
      return new Response(
        JSON.stringify({ profile, dashboard: null, error: dashErr.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ profile, dashboard }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
