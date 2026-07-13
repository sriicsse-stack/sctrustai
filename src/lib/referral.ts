const DEFAULT_REFERRAL_ORIGIN = "https://sctrustai.vercel.app";

function sanitizeReferralOrigin(value?: string | null): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const candidate = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    if (candidate.hostname.includes("supabase.co")) return null;
    return candidate.origin;
  } catch {
    return null;
  }
}

export function getReferralBaseOrigin(explicitOrigin?: string | null): string {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};
  const configuredOrigin = sanitizeReferralOrigin(explicitOrigin ?? (env as Record<string, string | undefined>).VITE_APP_URL ?? (env as Record<string, string | undefined>).VITE_REFERRAL_BASE_URL ?? "");

  if (configuredOrigin) return configuredOrigin;
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }

  return DEFAULT_REFERRAL_ORIGIN;
}

/**
 * Normalizes referral URLs - extracts the code and rebuilds with correct origin.
 * This handles URLs from edge functions that may use Supabase domain.
 * Example: http://iggslegczqjfbxsxqhjm.supabase.co/ref/CODE → https://sctrustai.vercel.app/ref/CODE
 */
export function normalizeReferralLink(linkOrCode: string | null | undefined): string | null {
  if (!linkOrCode) return null;

  try {
    // If it's a full URL, extract the code
    if (linkOrCode.includes("://")) {
      const url = new URL(linkOrCode);
      const pathMatch = url.pathname.match(/\/ref\/([A-Z0-9\-]+)/i);
      if (pathMatch?.[1]) {
        return buildReferralLink(pathMatch[1]);
      }
    }
    // If it's just a code, build the link
    else if (/^[A-Z0-9\-]+$/i.test(linkOrCode)) {
      return buildReferralLink(linkOrCode);
    }
  } catch {
    // Fall through to return null
  }

  return null;
}

export function buildReferralLink(code: string, explicitOrigin?: string | null): string {
  const normalizedCode = (code || "").trim();
  if (!normalizedCode) return "";
  return `${getReferralBaseOrigin(explicitOrigin)}/ref/${normalizedCode.toUpperCase()}`;
}
