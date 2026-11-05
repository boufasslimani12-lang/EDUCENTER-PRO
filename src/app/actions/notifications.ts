"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Mark the signed-in user's notifications as read (RLS limits the update to their own rows). */
export async function markNotificationsRead() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", data.user.id).is("read_at", null);
  revalidatePath("/", "layout");
}
