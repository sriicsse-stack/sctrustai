import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

async function verifyRazorpaySignature(
  orderId: string, paymentId: string, signature: string, secret: string
): Promise<boolean> {
  const payload = `${orderId}|${paymentId}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const buf = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const computed = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  return computed === signature;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId, planName } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !userId) {
      return new Response(JSON.stringify({ error: "Missing required payment fields." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!keySecret) {
      return new Response(JSON.stringify({ error: "Razorpay secret not configured." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Step 1: Verify HMAC-SHA256 signature
    const isValid = await verifyRazorpaySignature(
      razorpay_order_id, razorpay_payment_id, razorpay_signature, keySecret
    );
    if (!isValid) {
      console.error("[razorpay-verify] Signature mismatch for order:", razorpay_order_id);
      return new Response(JSON.stringify({ error: "Payment signature verification failed." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Step 2: Fetch authoritative transaction record
    const { data: txn, error: txnErr } = await supabase
      .from("payment_transactions").select("*")
      .eq("razorpay_order_id", razorpay_order_id).single();

    if (txnErr || !txn) {
      return new Response(JSON.stringify({ error: "Transaction record not found." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Idempotency guard
    if (txn.status === "paid") {
      return new Response(JSON.stringify({
        success: true, alreadyProcessed: true,
        planName: txn.plan_name, creditsAdded: txn.credits_added,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Step 3: Mark paid
    await supabase.from("payment_transactions").update({
      status: "paid", razorpay_payment_id, razorpay_signature,
    }).eq("razorpay_order_id", razorpay_order_id);

    // Step 4: Update profile — add credits + set plan
    const resolvedPlan = txn.plan_name || planName;
    const creditsToAdd = txn.credits_added || 0;

    const { data: profile } = await supabase
      .from("profiles").select("credits").eq("google_id", userId).maybeSingle();
    const newCredits = (profile?.credits ?? 0) + creditsToAdd;

    await supabase.from("profiles").update({
      subscription_plan: resolvedPlan, credits: newCredits,
    }).eq("google_id", userId);

    console.log(`[razorpay-verify] ✅ User=${userId} Plan=${resolvedPlan} +${creditsToAdd}cr → ${newCredits}cr`);

    return new Response(JSON.stringify({
      success: true, planName: resolvedPlan,
      creditsAdded: creditsToAdd, newCreditBalance: newCredits,
      receiptNumber: txn.receipt_number, paymentId: razorpay_payment_id,
      orderId: razorpay_order_id, amountPaise: txn.amount_paise,
      currency: txn.currency, paidAt: new Date().toISOString(),
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("[razorpay-verify] Error:", err?.message);
    return new Response(JSON.stringify({ error: err?.message || "Internal server error." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

// HMAC-SHA256 signature verification using the Razorpay key secret
async function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const payload = `${orderId}|${paymentId}`;
  const enc = new TextEncoder();
  const keyData = enc.encode(secret);
  const msgData = enc.encode(payload);

  const key = await crypto.subtle.importKey(
    "raw", keyData,
    { name: "HMAC", hash: "SHA-256" },
    false, ["sign"]
  );
  const signedBuffer = await crypto.subtle.sign("HMAC", key, msgData);
  const computed = Array.from(new Uint8Array(signedBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  return computed === signature;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      userId,
      planName,
    } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing required payment fields." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!keySecret) {
      return new Response(
        JSON.stringify({ error: "Razorpay secret not configured." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Step 1: Verify signature ──────────────────────────────────────────────
    const isValid = await verifyRazorpaySignature(
      razorpay_order_id, razorpay_payment_id, razorpay_signature, keySecret
    );

    if (!isValid) {
      console.error("[razorpay-verify] Signature mismatch for order:", razorpay_order_id);
      return new Response(
        JSON.stringify({ error: "Payment signature verification failed. Possible fraud attempt." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Step 2: Fetch the transaction record (authoritative source for credits/plan) ──
    const { data: txn, error: txnErr } = await supabase
      .from("payment_transactions")
      .select("*")
      .eq("razorpay_order_id", razorpay_order_id)
      .single();

    if (txnErr || !txn) {
      console.error("[razorpay-verify] Transaction not found:", razorpay_order_id);
      return new Response(
        JSON.stringify({ error: "Transaction record not found." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Idempotency guard — don't double-credit
    if (txn.status === "paid") {
      return new Response(
        JSON.stringify({
          success: true,
          alreadyProcessed: true,
          planName: txn.plan_name,
          creditsAdded: txn.credits_added,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Step 3: Mark transaction as paid ─────────────────────────────────────
    const { error: updateErr } = await supabase
      .from("payment_transactions")
      .update({
        status:               "paid",
        razorpay_payment_id,
        razorpay_signature,
      })
      .eq("razorpay_order_id", razorpay_order_id);

    if (updateErr) {
      console.error("[razorpay-verify] Failed to update transaction:", updateErr.message);
      return new Response(
        JSON.stringify({ error: "Failed to record payment. Contact support." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Step 4: Update user profile — plan + credits ──────────────────────────
    const resolvedPlan = txn.plan_name || planName;
    const creditsToAdd = txn.credits_added || 0;

    // Fetch current credits first
    const { data: profile } = await supabase
      .from("profiles")
      .select("credits")
      .eq("google_id", userId)
      .maybeSingle();

    const currentCredits = profile?.credits ?? 0;
    const newCredits = currentCredits + creditsToAdd;

    await supabase
      .from("profiles")
      .update({
        subscription_plan: resolvedPlan,
        credits: newCredits,
      })
      .eq("google_id", userId);

    console.log(`[razorpay-verify] ✅ Payment verified. User=${userId} Plan=${resolvedPlan} Credits+=${creditsToAdd} New balance=${newCredits}`);

    return new Response(
      JSON.stringify({
        success: true,
        planName: resolvedPlan,
        creditsAdded: creditsToAdd,
        newCreditBalance: newCredits,
        receiptNumber: txn.receipt_number,
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        amountPaise: txn.amount_paise,
        currency: txn.currency,
        paidAt: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[razorpay-verify] Unhandled error:", err?.message);
    return new Response(
      JSON.stringify({ error: err?.message || "Internal server error." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
