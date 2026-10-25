// ==============================================================================
// ACCRUAL SUPABASE EDGE FUNCTION: REVENUECAT WEBHOOK HANDLER
// Synchronizes subscription lifecycle events (purchase, renewal, cancellation, expiration)
// from RevenueCat to Supabase 'user_subscriptions' table using service_role key.
// ==============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Verify Authorization Bearer (Shared Webhook Secret from RevenueCat)
    const authHeader = req.headers.get("Authorization");
    const webhookSecret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
    if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json();
    const event = payload?.event;
    if (!event) {
      return new Response(JSON.stringify({ message: "No event payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appUserId = event.app_user_id;
    // Skip anonymous RevenueCat users ($RCAnonymousID:...) until aliased
    if (!appUserId || appUserId.startsWith("$RCAnonymousID:") || appUserId === "guest") {
      return new Response(JSON.stringify({ message: "Ignored anonymous/guest user event" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase Admin Client (Bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const eventType = event.type;
    const productId = event.product_id;
    const isLifetime = productId === "accrual_lifetime_499k";
    const purchasedAt = event.purchased_at_ms ? new Date(event.purchased_at_ms).toISOString() : null;
    const expiresAt = isLifetime ? null : event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null;

    let tier: "free" | "premium" = "free";
    let status: "active" | "trialing" | "canceled" | "expired" | "past_due" = "active";

    switch (eventType) {
      case "INITIAL_PURCHASE":
      case "RENEWAL":
      case "PRODUCT_CHANGE":
      case "UNCANCELLATION":
        tier = "premium";
        status = event.period_type === "TRIAL" ? "trialing" : "active";
        break;
      case "CANCELLATION":
        // User canceled auto-renew, but might still have access until period ends
        tier = expiresAt && new Date(expiresAt) > new Date() ? "premium" : "free";
        status = "canceled";
        break;
      case "EXPIRATION":
        tier = "free";
        status = "expired";
        break;
      case "BILLING_ISSUE":
        status = "past_due";
        break;
      default:
        tier = "premium";
        status = "active";
        break;
    }

    // Upsert into user_subscriptions
    const { error } = await supabaseAdmin.from("user_subscriptions").upsert(
      {
        user_id: appUserId,
        tier,
        status,
        plan_id: productId || null,
        store: "app_store",
        original_transaction_id: event.original_transaction_id || null,
        current_period_start: purchasedAt,
        current_period_end: expiresAt,
        is_lifetime: isLifetime,
        raw_payload: event,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (error) {
      console.error("[RevenueCat Webhook] Upsert error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, user_id: appUserId, tier, status }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[RevenueCat Webhook] Unhandled exception:", err);
    return new Response(JSON.stringify({ error: err?.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
