import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase client authenticated with the service-role key.
 *
 * The service-role key bypasses Row Level Security, which is appropriate
 * for a backend reporting service that writes on behalf of all users.
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment
 * (loaded by the caller via dotenv or process.env).
 */
export function createSupabaseClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url) throw new Error("SUPABASE_URL environment variable is not set");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY environment variable is not set");

  return createClient(url, key, {
    auth: {
      // Service-role clients do not need session persistence
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
