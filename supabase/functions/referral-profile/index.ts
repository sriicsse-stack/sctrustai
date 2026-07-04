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

    // If profile has no referral_code/referral_link, attempt to create one server-side
    try {
      const prof = (dashboard && (dashboard as any).profile) || profile;
      if (prof && (!prof.referral_code || !prof.referral_link)) {
        // generate a TMAI-XXXXXXX style code
        const generateReferralCode = () => {
          const rand = Math.random().toString(36).substring(2, 10).toUpperCase();
          return `TMAI-${rand}`;
        };

        let code = generateReferralCode();
        let exists = true;
        for (let i = 0; i < 6 && exists; i++) {
          const { data: ex } = await supabase.from('referrals').select('id').eq('referral_code', code).limit(1);
          if (!ex || (Array.isArray(ex) && ex.length === 0)) exists = false; else code = generateReferralCode();
        }

        const appUrl = Deno.env.get('APP_URL') || '';
        const link = `${(appUrl || '').replace(/\/$/, '') || ''}/ref/${code}`;

        const { data: inserted, error: insertErr } = await supabase.from('referrals').insert([{ referral_code: code, referral_link: link, referrer_user_id: user_id }]).select().single();
        if (!insertErr && inserted) {
          // attach to dashboard/profile to return to client
          if (dashboard && (dashboard as any).profile) {
            (dashboard as any).profile.referral_code = inserted.referral_code;
            (dashboard as any).profile.referral_link = inserted.referral_link;
          } else {
            (profile as any).referral_code = inserted.referral_code;
            (profile as any).referral_link = inserted.referral_link;
          }
        }
      }
    } catch (e) {
      console.warn('auto-generate referral failed in referral-profile function:', String(e));
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
