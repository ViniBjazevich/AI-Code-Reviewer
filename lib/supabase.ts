import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Fall back to placeholder values so the client can be constructed at build
// time (e.g. during `next build`'s page data collection) even before real
// Supabase credentials are configured in the environment.
const supabaseUrl = process.env.SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || "placeholder-secret-key";

/**
 * Server-only Supabase client authenticated with the secret key.
 * Bypasses RLS — never import this into client components.
 */
export const supabaseServer: SupabaseClient = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
