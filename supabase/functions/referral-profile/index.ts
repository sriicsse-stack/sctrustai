import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Upsert profile and optionally fetch referral dashboard data
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log("[referral-profile] Incoming request:", req.method, req.url);
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const requestBody = await req.json();
    console.log("[referral-profile] Request body received:", { user_id: requestBody.user_id, email: requestBody.email });
    
    const { user_id, email, name, picture, fetch_dashboard, auto_create_referral } = requestBody;

    if (!user_id || !email) {
      console.error("[referral-profile] Missing required fields:", { user_id, email });
      return new Response(
        JSON.stringify({ error: 'Missing required fields: user_id, email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log("[referral-profile] Calling upsert_profile for user:", user_id);
    
    // Upsert profile
    const { data: profile, error: profileErr } = await supabase.rpc('upsert_profile', {
      p_id: user_id,
      p_email: email,
      p_name: name || '',
      p_picture: picture || '',
    });

    if (profileErr) {
      console.error('[referral-profile] upsert_profile error:', profileErr);
      return new Response(
        JSON.stringify({ error: profileErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    
    console.log("[referral-profile] Profile upserted successfully:", { id: user_id, referral_code: (profile as any)?.referral_code });

    if (!fetch_dashboard) {
      console.log("[referral-profile] Returning profile only (fetch_dashboard=false)");
      return new Response(
        JSON.stringify({ profile }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Also fetch dashboard
    console.log("[referral-profile] Fetching dashboard for user:", user_id);
    
    const { data: dashboard, error: dashErr } = await supabase.rpc('get_referral_dashboard', {
      p_user_id: user_id,
    });

    if (dashErr) {
      console.error('[referral-profile] get_referral_dashboard error:', dashErr);
      return new Response(
        JSON.stringify({ profile, dashboard: null, error: dashErr.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    
    console.log("[referral-profile] Dashboard fetched successfully");

    // If profile has no referral_code/referral_link and auto_create_referral is requested, attempt to create one server-side
    if (auto_create_referral) {
      try {
        const prof = (dashboard && (dashboard as any).profile) || profile;
        if (prof && (!prof.referral_code || !prof.referral_link)) {
          console.log("[referral-profile] auto_create_referral=true, generating referral code");
          
          // Verify `referrals` table exists by attempting a lightweight select.
          try {
            const { error: testErr } = await supabase.from('referrals').select('id').limit(1);
            if (testErr) {
              // Table likely missing or permission denied — attach warning and skip creation
              console.error("[referral-profile] referrals table test error:", testErr);
              return new Response(
                JSON.stringify({ profile, dashboard, migrations_missing: true, message: 'Referrals table missing or inaccessible. Apply migrations.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
              );
            }
          } catch (te) {
            console.error("[referral-profile] referrals table test exception:", te);
            return new Response(
              JSON.stringify({ profile, dashboard, migrations_missing: true, message: 'Referrals table missing or inaccessible. Apply migrations.' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
            );
          }
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

          console.log("[referral-profile] Generated referral code:", code, "link:", link);
          
          const { data: inserted, error: insertErr } = await supabase.from('referrals').insert([{ referral_code: code, referral_link: link, referrer_user_id: user_id }]).select().single();
          if (insertErr) {
            console.error("[referral-profile] Failed to insert referral:", insertErr);
          } else if (inserted) {
            console.log("[referral-profile] Referral inserted successfully:", inserted);
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
        console.error('[referral-profile] auto-generate referral exception:', String(e));
      }
    } else {
      console.log("[referral-profile] auto_create_referral=false, skipping referral generation");
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
