import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

function generateReferralCode() {
  return `TMAI-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

// Upsert profile and optionally fetch referral dashboard data
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('[referral-profile] Incoming request:', req.method, req.url);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceKey) {
      console.error('[referral-profile] Missing Supabase function environment variables. SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.');
      return new Response(
        JSON.stringify({ error: 'Supabase configuration error', detail: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const requestBody = await req.json();
    console.log('[referral-profile] Request body received:', { user_id: requestBody.user_id, email: requestBody.email, fetch_dashboard: requestBody.fetch_dashboard, auto_create_referral: requestBody.auto_create_referral });

    const { user_id, email, name, picture, fetch_dashboard, auto_create_referral } = requestBody;
    // Use APP_URL from environment, with fallback to production domain. Never use Supabase domain.
    const appUrl = (Deno.env.get('APP_URL') || Deno.env.get('VITE_APP_URL') || 'https://sctrustai.vercel.app').replace(/\/$/, '');
    const normalizeReferralLink = (prof: any) => {
      if (prof && prof.referral_code && appUrl) {
        // Always rebuild referral_link to ensure correct domain, regardless of what's in DB
        prof.referral_link = `${appUrl}/ref/${prof.referral_code}`;
      }
    };

    if (!user_id || !email) {
      console.error('[referral-profile] Missing required fields:', { user_id, email });
      return new Response(
        JSON.stringify({ error: 'Missing required fields: user_id, email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let responseProfile: any = null;
    const isMissingTableError = (err: any) => ['PGRST205', '42P01', '42501'].includes(err?.code);

    try {
      const { data: upsertedProfile, error: upsertErr } = await supabase.rpc('upsert_profile', {
        p_id: user_id,
        p_email: email,
        p_name: name || '',
        p_picture: picture || '',
      });

      if (upsertErr && isMissingTableError(upsertErr)) {
        console.warn('[referral-profile] profiles table unavailable for upsert, falling back to select', upsertErr);
      } else if (upsertErr) {
        console.error('[referral-profile] upsert_profile error:', upsertErr);
      } else {
        responseProfile = upsertedProfile;
      }
    } catch (upsertException) {
      console.warn('[referral-profile] upsert_profile exception, falling back to select', upsertException);
    }

    if (!responseProfile) {
      try {
        const { data: existingProfile, error: profileSelectErr } = await supabase
          .from('profiles')
          .select('id, email, name, picture, credits, referral_code, referral_link, created_at, updated_at')
          .eq('id', user_id)
          .maybeSingle();

        if (profileSelectErr && isMissingTableError(profileSelectErr)) {
          console.warn('[referral-profile] profiles table unavailable, using fallback profile payload');
        } else if (profileSelectErr) {
          console.error('[referral-profile] profile lookup error:', profileSelectErr);
        } else {
          responseProfile = existingProfile;
        }
      } catch (profileLookupErr) {
        console.warn('[referral-profile] profile lookup exception, using fallback payload:', profileLookupErr);
      }
    }

    if (!responseProfile) {
      responseProfile = {
        id: user_id,
        email,
        name: name || '',
        picture: picture || '',
        credits: 0,
        referral_code: '',
        referral_link: '',
      };
    }

    if (responseProfile && !responseProfile.referral_code) {
      const generatedCode = `TMAI-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
      responseProfile.referral_code = generatedCode;
      normalizeReferralLink(responseProfile);
    }
    console.log('[referral-profile] Profile loaded successfully:', { id: user_id, referral_code: responseProfile?.referral_code });

    if (auto_create_referral && (!responseProfile?.referral_code || !responseProfile?.referral_link)) {
      console.log('[referral-profile] Creating referral code for profile:', user_id);
      let code = generateReferralCode();
      let attempts = 0;
      while (attempts < 6) {
        const { data: existing } = await supabase.from('profiles').select('id').eq('referral_code', code).maybeSingle();
        if (!existing) break;
        code = generateReferralCode();
        attempts += 1;
      }

      const { data: updatedProfile, error: updateErr } = await supabase
        .from('profiles')
        .update({ referral_code: code, updated_at: new Date().toISOString() })
        .eq('id', user_id)
        .select()
        .single();

      if (updateErr) {
        console.error('[referral-profile] Failed to save referral code:', updateErr);
      } else {
        responseProfile = updatedProfile;
        normalizeReferralLink(responseProfile);
        console.log('[referral-profile] Referral code saved:', code);
      }
    }

    if (!fetch_dashboard) {
      normalizeReferralLink(responseProfile);
      console.log('[referral-profile] Returning profile only (fetch_dashboard=false)');
      return new Response(
        JSON.stringify({ profile: responseProfile }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let referralsData: any[] = [];
    let rewardsData: any[] = [];
    try {
      const { data: referralsResult, error: referralsErr } = await supabase
        .from('referrals')
        .select('id, referred_user_id, status, deploy_rewarded, paid_rewarded, created_at')
        .eq('referrer_id', user_id)
        .order('created_at', { ascending: false });

      const { data: rewardsResult, error: rewardsErr } = await supabase
        .from('referral_rewards')
        .select('credits, reward_type, created_at')
        .eq('user_id', user_id)
        .order('created_at', { ascending: false });

      if (referralsErr && !isMissingTableError(referralsErr)) {
        console.error('[referral-profile] referrals query error:', referralsErr);
      } else if (!referralsErr) {
        referralsData = referralsResult ?? [];
      }

      if (rewardsErr && !isMissingTableError(rewardsErr)) {
        console.error('[referral-profile] rewards query error:', rewardsErr);
      } else if (!rewardsErr) {
        rewardsData = rewardsResult ?? [];
      }
    } catch (dashboardErr) {
      console.warn('[referral-profile] dashboard fallback due to query exception:', dashboardErr);
    }

    const dashboard = {
      profile: {
        ...responseProfile,
        credits: responseProfile?.credits ?? 0,
        referral_code: responseProfile?.referral_code ?? '',
        referral_link: responseProfile?.referral_link ?? '',
      },
      referrals: (referralsData ?? []).map((item: any) => ({
        id: item.id,
        referred_user_id: item.referred_user_id,
        referred_name: '',
        referred_email: '',
        status: item.status,
        deploy_rewarded: item.deploy_rewarded,
        paid_rewarded: item.paid_rewarded,
        created_at: item.created_at,
      })),
      stats: {
        total_referrals: (referralsData ?? []).length,
        successful_referrals: (referralsData ?? []).filter((item: any) => item.status !== 'signed_up' || item.deploy_rewarded || item.paid_rewarded).length,
        deploy_bonuses: (referralsData ?? []).filter((item: any) => item.deploy_rewarded).length,
        paid_bonuses: (referralsData ?? []).filter((item: any) => item.paid_rewarded).length,
        credits_earned: (rewardsData ?? []).reduce((sum: number, item: any) => sum + (item.credits ?? 0), 0),
      },
    };

    normalizeReferralLink(responseProfile);
    normalizeReferralLink(dashboard.profile);

    return new Response(
      JSON.stringify({ profile: responseProfile, dashboard }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[referral-profile] Unhandled error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
