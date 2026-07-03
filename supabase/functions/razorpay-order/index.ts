import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// ── Plan catalogue (server-authoritative — never trust client amounts) ─────────
const PLANS: Record<string, { amountPaise: number; credits: number; isUnlimited: boolean }> = {
  Basic:    { amountPaise: 29900,  credits: 25,   isUnlimited: false },
  Medium:   { amountPaise: 99900,  credits: 100,  isUnlimited: false },
  Gold:     { amountPaise: 199900, credits: 300,  isUnlimited: false },
  Platinum: { amountPaise: 499900, credits: 1000, isUnlimited: true  },
};

const STUDENT_PLANS: Record<string, { amountPaise: number }> = {
  Basic:    { amountPaise: 14900 },
  Medium:   { amountPaise: 49900 },
  Gold:     { amountPaise: 99900 },
  Platinum: { amountPaise: 249900 },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { planName, userId, isStudent = false } = await req.json();

    if (!planName || !userId) {
      return new Response(JSON.stringify({ error: "planName and userId are required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const plan = PLANS[planName];
    if (!plan) {
      return new Response(JSON.stringify({ error: `Unknown plan: ${planName}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const keyId     = Deno.env.get("RAZORPAY_KEY_ID");
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!keyId || !keySecret) {
      return new Response(JSON.stringify({ error: "Razorpay keys not configured." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const amountPaise = isStudent
      ? (STUDENT_PLANS[planName]?.amountPaise ?? plan.amountPaise)
      : plan.amountPaise;

    const receiptNumber = `rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const basicAuth = btoa(`${keyId}:${keySecret}`);
    const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Authorization": `Basic ${basicAuth}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt: receiptNumber,
        notes: { planName, userId, isStudent: String(isStudent) },
      }),
    });

    if (!rzpRes.ok) {
      const errText = await rzpRes.text();
      console.error("[razorpay-order] Razorpay API error:", errText);
      return new Response(JSON.stringify({ error: "Failed to create Razorpay order.", detail: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const order = await rzpRes.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { error: dbErr } = await supabase.from("payment_transactions").insert({
      user_id:           userId,
      razorpay_order_id: order.id,
      plan_name:         planName,
      amount_paise:      amountPaise,
      currency:          "INR",
      credits_added:     plan.credits,
      status:            "created",
      is_student:        isStudent,
      receipt_number:    receiptNumber,
    });
    if (dbErr) console.error("[razorpay-order] DB insert:", dbErr.message);

    return new Response(JSON.stringify({
      orderId: order.id, amount: amountPaise, currency: "INR",
      keyId, receiptNumber, planName, credits: plan.credits, isUnlimited: plan.isUnlimited,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("[razorpay-order] Error:", err?.message);
    return new Response(JSON.stringify({ error: err?.message || "Internal server error." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
