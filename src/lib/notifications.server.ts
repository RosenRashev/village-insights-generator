import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Известия към потребителите (камбанката в хедъра). Таблицата `notifications` се пише само
 * със service role. Изпращането е „бонус“: при грешка се записва предупреждение, без да
 * проваля основното действие (зареждане на доклади, заявка и т.н.).
 */

async function admin(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

export type NotificationKind =
  "credits_added" | "credits_request" | "request_rejected" | "credits_empty" | "welcome";

export type NotificationInput = {
  kind: NotificationKind;
  title: string;
  body?: string | null;
  link?: string | null;
};

export type NotificationRow = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export async function notify(userIds: string[], n: NotificationInput): Promise<void> {
  if (userIds.length === 0) return;
  try {
    const { error } = await (await admin()).from("notifications").insert(
      userIds.map((user_id) => ({
        user_id,
        kind: n.kind,
        title: n.title.slice(0, 200),
        body: n.body ? n.body.slice(0, 500) : null,
        link: n.link ?? null,
      })),
    );
    if (error) console.warn("[notify] не е записано:", error.message);
  } catch (err) {
    console.warn("[notify] грешка:", err);
  }
}

export async function adminIds(): Promise<string[]> {
  const { data, error } = await (await admin()).from("profiles").select("id").eq("is_admin", true);
  if (error) return [];
  return (data ?? []).map((r) => r.id as string);
}

export async function emailOf(userId: string): Promise<string | null> {
  const { data } = await (
    await admin()
  )
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  return (data?.email as string | null | undefined) ?? null;
}

export async function listNotifications(
  userId: string,
  limit = 8,
): Promise<{ items: NotificationRow[]; unread: number }> {
  const db = await admin();
  const { data, error } = await db
    .from("notifications")
    .select("id, kind, title, body, link, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  const { count } = await db
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  return { items: (data ?? []) as NotificationRow[], unread: count ?? 0 };
}

export async function markAllRead(userId: string): Promise<void> {
  const { error } = await (
    await admin()
  )
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw new Error(error.message);
}
