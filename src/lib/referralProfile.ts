import type { SupabaseClient } from "@supabase/supabase-js";
import { safeInvoke, type InvokeResponse } from "./safeInvoke";

interface ReferralProfileOptions {
  body?: Record<string, any>;
  headers?: Record<string, string>;
}

const pendingReferralProfileRequests = new Map<string, Promise<InvokeResponse<any>>>();

function stableStringify(value: any): string {
  if (value === null || value === undefined) return "";
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
}

function requestKey(functionName: string, options?: ReferralProfileOptions): string {
  const bodyKey = stableStringify(options?.body ?? {});
  const headersKey = stableStringify(options?.headers ?? {});
  return `${functionName}|${bodyKey}|${headersKey}`;
}

export async function getReferralProfile(
  supabase: SupabaseClient,
  options?: ReferralProfileOptions
): Promise<InvokeResponse<any>> {
  const key = requestKey("referral-profile", options);

  if (pendingReferralProfileRequests.has(key)) {
    return pendingReferralProfileRequests.get(key)!;
  }

  const promise = safeInvoke<any>(supabase, "referral-profile", options).finally(() => {
    pendingReferralProfileRequests.delete(key);
  });

  pendingReferralProfileRequests.set(key, promise);
  return promise;
}
