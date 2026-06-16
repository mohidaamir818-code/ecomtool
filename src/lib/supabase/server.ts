import "server-only";

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!adminClient) {
    adminClient = createClient(
      serverEnv.supabaseUrl(),
      serverEnv.supabaseServiceRoleKey(),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  return adminClient;
}
