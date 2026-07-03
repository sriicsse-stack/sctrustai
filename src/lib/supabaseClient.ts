import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anonKey) {
  console.warn("[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient(url || "", anonKey || "");

export interface StudentVerification {
  id?: string;
  user_id: string;
  full_name: string;
  college_name: string;
  department: string;
  year: string;
  student_id: string;
  college_email: string;
  mobile_number: string;
  id_card_front_url?: string;
  id_card_back_url?: string;
  document_url?: string;
  verification_status?: "pending" | "approved" | "rejected";
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  status?: "pending" | "approved" | "rejected"; // legacy fallback
  submitted_at?: string;
  created_at?: string;
  reviewed_at?: string;
  reviewer_notes?: string;
  bonus_credits?: number;
  discount_percentage?: number;
}
