import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server";

export interface LogUserRequestInput {
  userId: string;
  endpoint: string;
  method?: string;
  status: "success" | "failed";
}

export async function logUserApiRequest(input: LogUserRequestInput): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("user_api_requests").insert({
      user_id: input.userId,
      endpoint: input.endpoint,
      method: input.method ?? "POST",
      status: input.status,
    });

    if (error && !error.message.includes("does not exist")) {
      console.error("[request-tracker]", error.message);
    }
  } catch (error) {
    console.error("[request-tracker]", error);
  }
}
