import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Safe wrapper for supabase.functions.invoke() with proper error handling
 * 
 * Handles:
 * - Empty response bodies
 * - Invalid JSON parsing
 * - Error responses from edge functions
 * - Type-safe data extraction
 */
export async function safeInvoke<T = any>(
  supabase: SupabaseClient,
  functionName: string,
  options?: {
    body?: Record<string, any>;
    headers?: Record<string, string>;
  }
): Promise<{ data: T | null; error: Error | null }> {
  try {
    // Call the edge function
    const { data, error: invokeError } = await supabase.functions.invoke(functionName, options);

    // Handle invoke-level errors (network, auth, etc)
    if (invokeError) {
      console.error(`[safeInvoke] ${functionName} invoke error:`, invokeError.message || invokeError);
      return {
        data: null,
        error: new Error(`Failed to call ${functionName}: ${invokeError.message || "Unknown error"}`),
      };
    }

    // Check if data exists and is not null
    if (data === null || data === undefined) {
      console.error(`[safeInvoke] ${functionName} returned empty response body`);
      return {
        data: null,
        error: new Error(`${functionName} returned empty response`),
      };
    }

    // If the edge function returned a string payload, attempt to parse JSON as a best effort
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        if (parsed !== null && typeof parsed === 'object') {
          return { data: parsed as T, error: null };
        }
      } catch (parseErr) {
        console.warn(`[safeInvoke] ${functionName} returned string response that could not be parsed as JSON`, parseErr);
      }
    }

    // If data is an object with an 'error' field, extract and return as error
    if (typeof data === "object" && data !== null && "error" in data && data.error) {
      const errorMessage = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
      console.error(`[safeInvoke] ${functionName} returned error:`, errorMessage);
      return {
        data: null,
        error: new Error(errorMessage),
      };
    }

    // Success: return data
    console.log(`[safeInvoke] ${functionName} success`);
    return { data: data as T, error: null };
  } catch (err: any) {
    // Catch any unexpected errors (JSON parse errors, etc)
    console.error(`[safeInvoke] ${functionName} caught error:`, err?.message || err);
    return {
      data: null,
      error: new Error(`Error calling ${functionName}: ${err?.message || "Unknown error"}`),
    };
  }
}

/**
 * Type-safe response from edge function
 */
export interface InvokeResponse<T = any> {
  data: T | null;
  error: Error | null;
}

/**
 * Helper to check if invoke was successful
 */
export function isInvokeSuccess<T>(response: InvokeResponse<T>): response is { data: T; error: null } {
  return response.error === null && response.data !== null;
}

/**
 * Helper to safely access nested properties on response data
 */
export function getErrorMessage(data: any): string | null {
  if (!data) return null;
  if (typeof data.error === "string") return data.error;
  if (typeof data.message === "string") return data.message;
  if (typeof data.detail === "string") return data.detail;
  return null;
}
