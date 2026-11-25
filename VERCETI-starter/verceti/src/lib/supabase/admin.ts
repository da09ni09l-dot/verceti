import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Prefer Supabase's current server-side secret key. Keep the legacy
  // service-role key as a backwards-compatible fallback.
  const adminKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !adminKey) {
    throw new Error("Не налаштовані серверні ключі Supabase.");
  }

  return createSupabaseClient(url, adminKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
