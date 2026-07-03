import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { referrer_code, new_user_id, new_user_email, new_user_name, new_user_picture } = await req.json();

    if (!referrer_code || !new_user_id || !new_user_email) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: referrer_code, new_user_id, new_user_email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 1. Upsert the new user's profile
    const { data: newProfile, error: profileErr } = await supabase
      .rpc('upsert_profile', {
        p_id: new_user_id,
        p_email: new_user_email,
        p_name: new_user_name || '',
        p_picture: new_user_picture || '',
      });

    if (profileErr) {
      console.error('upsert_profile error:', profileErr);
      return new Response(
        JSON.stringify({ error: 'Failed to upsert profile', detail: profileErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 2. Look up referrer by referral_code
    const { data: referrerProfile, error: referrerErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('referral_code', referrer_code.toUpperCase())
      .maybeSingle();

    if (referrerErr || !referrerProfile) {
      // Referral code not found — still created profile, just no bonus
      return new Response(
        JSON.stringify({ success: true, profile: newProfile, referral: null, reason: 'referrer_not_found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 3. Process referral signup (anti-abuse inside the function)
    const { data: result, error: refErr } = await supabase
      .rpc('process_referral_signup', {
        p_referrer_id: referrerProfile.id,
        p_referred_user_id: new_user_id,
      });

    if (refErr) {
      console.error('process_referral_signup error:', refErr);
      return new Response(
        JSON.stringify({ success: true, profile: newProfile, referral: null, reason: refErr.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, profile: newProfile, referral: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('referral-signup error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
