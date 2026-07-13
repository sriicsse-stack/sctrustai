import test from "node:test";
import assert from "node:assert/strict";
import { buildReferralLink, getReferralBaseOrigin } from "../src/lib/referral.ts";

test("buildReferralLink never uses a Supabase host", () => {
  assert.equal(buildReferralLink("ABC123", "https://example.supabase.co"), "https://sctrustai.vercel.app/ref/ABC123");
  assert.equal(getReferralBaseOrigin("https://example.supabase.co"), "https://sctrustai.vercel.app");
});

test("buildReferralLink preserves a frontend origin when provided", () => {
  assert.equal(buildReferralLink("ABC123", "https://app.example.com"), "https://app.example.com/ref/ABC123");
});
