import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

if (!isBuildPhase && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY)) {
  throw new Error("Missing required environment variables: SUPABASE_URL and SUPABASE_SECRET_KEY");
}

const supabaseUrl = process.env.SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || "placeholder-secret-key";


export const supabaseServer: SupabaseClient = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
