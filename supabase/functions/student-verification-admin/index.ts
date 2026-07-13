import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * student-verification-admin: Secure server-side admin operations for student verification
 * 
 * Operations:
 * - GET /pending: Fetch all pending verifications (admin only)
 * - POST /update: Approve or reject a verification with admin auth (admin only)
 * 
 * Authorization: Caller must be authenticated and have 'admin' role
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('[student-verification-admin] Incoming request:', req.method, req.url);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Extract Authorization header to verify authenticated user
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      console.error('[student-verification-admin] Missing or invalid Authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing bearer token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Verify JWT and get user
    const token = authHeader.substring(7);
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);

    if (userErr || !user) {
      console.error('[student-verification-admin] Invalid token:', userErr?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log('[student-verification-admin] Authenticated user:', user.id);

    // Check if user has admin role (via app_metadata or custom claim)
    const isAdmin = user.app_metadata?.roles?.includes('admin') || user.user_metadata?.is_admin === true;
    
    // Hardcoded admin user IDs (fallback for development)
    const adminUserIds = [
      // Add known admin user IDs here if needed
    ];
    const isHardcodedAdmin = adminUserIds.includes(user.id);

    if (!isAdmin && !isHardcodedAdmin) {
      console.error('[student-verification-admin] User is not an admin:', user.id);
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log('[student-verification-admin] Admin verified:', user.id);

    // Parse request body to determine operation
    let requestBody: any = {};
    if (req.method === 'POST') {
      try {
        requestBody = await req.json();
      } catch (parseErr) {
        console.warn('[student-verification-admin] Failed to parse JSON body:', parseErr);
        requestBody = {};
      }
    }
    const action = requestBody.action || 'list';

    // ── ACTION: List pending verifications ──────────────────────────────────────────
    if (action === 'list' && req.method === 'GET') {
      console.log('[student-verification-admin] Fetching pending verifications');
      
      const { data, error } = await supabase
        .from('student_verifications')
        .select('*')
        .eq('status', 'pending')
        .order('submitted_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('[student-verification-admin] Failed to fetch pending:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch verifications', detail: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      console.log('[student-verification-admin] ✅ Fetched pending verifications:', (data || []).length);
      return new Response(
        JSON.stringify({ records: data || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── ACTION: Update verification (approve/reject) ────────────────────────────────
    if (action === 'update' && req.method === 'POST') {
      const { id, status, bonus_credits, discount_percentage, reviewer_notes } = requestBody;

      console.log('[student-verification-admin] Updating verification:', { id, status });

      if (!id || !status || !['approved', 'rejected'].includes(status)) {
        console.error('[student-verification-admin] Invalid update parameters:', { id, status });
        return new Response(
          JSON.stringify({ error: 'Invalid parameters: id and status (approved/rejected) required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // Fetch the record to get user_id and current data
      const { data: record, error: fetchErr } = await supabase
        .from('student_verifications')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchErr || !record) {
        console.error('[student-verification-admin] Record not found:', id);
        return new Response(
          JSON.stringify({ error: 'Verification record not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const isApprove = status === 'approved';
      const bonusCredits = isApprove ? (bonus_credits || 100) : 0;
      const discountPercent = isApprove ? (discount_percentage || 50) : 0;
      const rejectionReason = !isApprove ? (reviewer_notes || 'Verification rejected by admin.') : null;

      // 1. Update verification record
      console.log('[student-verification-admin] Updating verification record');
      const { error: updateVerfErr } = await supabase
        .from('student_verifications')
        .update({
          status: status,
          verification_status: status,
          reviewer_notes: reviewer_notes || null,
          rejection_reason: rejectionReason,
          approved_by: isApprove ? user.id : null,
          approved_at: isApprove ? new Date().toISOString() : null,
          bonus_credits: bonusCredits,
          discount_percentage: discountPercent,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (updateVerfErr) {
        console.error('[student-verification-admin] Failed to update verification:', updateVerfErr);
        return new Response(
          JSON.stringify({ error: 'Failed to update verification', detail: updateVerfErr.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // 2. If approved, update user profile with bonus credits and discount
      if (isApprove && record.user_id) {
        console.log('[student-verification-admin] Approving - updating profile for user:', record.user_id);
        
        const { data: profile, error: profileFetchErr } = await supabase
          .from('profiles')
          .select('id, credits')
          .eq('id', record.user_id)
          .single();

        if (profileFetchErr) {
          console.warn('[student-verification-admin] Failed to fetch profile:', profileFetchErr);
        } else if (profile) {
          const newCredits = (profile.credits || 0) + bonusCredits;
          
          const { error: profileUpdateErr } = await supabase
            .from('profiles')
            .update({
              credits: newCredits,
              student_discount_active: true,
              student_status: 'approved',
              updated_at: new Date().toISOString(),
            })
            .eq('id', record.user_id);

          if (profileUpdateErr) {
            console.error('[student-verification-admin] Failed to update profile:', profileUpdateErr);
          } else {
            console.log('[student-verification-admin] ✅ Profile updated. Credits:', newCredits);
          }
        }
      }

      // 3. If rejected, update profile to reflect rejection
      if (!isApprove && record.user_id) {
        console.log('[student-verification-admin] Rejecting - updating profile for user:', record.user_id);
        
        const { error: profileUpdateErr } = await supabase
          .from('profiles')
          .update({
            student_discount_active: false,
            student_status: 'rejected',
            updated_at: new Date().toISOString(),
          })
          .eq('id', record.user_id);

        if (profileUpdateErr) {
          console.error('[student-verification-admin] Failed to update profile:', profileUpdateErr);
        } else {
          console.log('[student-verification-admin] ✅ Profile rejection status updated');
        }
      }

      console.log('[student-verification-admin] ✅ Verification update completed:', { id, status });
      return new Response(
        JSON.stringify({ success: true, message: `Verification ${status}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Unrecognized action
    console.error('[student-verification-admin] Unknown action:', action);
    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    console.error('[student-verification-admin] Unhandled error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
