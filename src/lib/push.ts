import "server-only";
import webpush, { type PushSubscription as WebPushSubscription } from "web-push";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { shouldSendPush, type NotifKind, type NotifPrefs } from "@/lib/notification-preferences";

export type { NotifKind };

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

let vapidConfigured = false;

function configureVapid(): boolean {
  if (vapidConfigured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails("mailto:no-reply@eglise.app", publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export function isPushEnabled(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type SubRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type NotifPrefsRow = NotifPrefs;

async function fetchNotifPrefs(admin: ReturnType<typeof serviceClient>, userId: string): Promise<NotifPrefs | null> {
  if (!admin) return null;
  const { data, error } = await admin
    .from("notification_preferences")
    .select(
      "reminder_2h, imminent_departure, new_request, decision, trajet_cancelled, new_message, thanks_received, weekly_summary_admin, engagement_relance",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as NotifPrefsRow;
}

export async function sendPushTo(userId: string, kind: NotifKind, payload: PushPayload): Promise<void> {
  if (!configureVapid()) return;
  const admin = serviceClient();
  if (!admin) return;

  const prefs = await fetchNotifPrefs(admin, userId);
  if (!shouldSendPush(prefs, kind)) return;

  const { data, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (error || !data || data.length === 0) return;

  const subs = data as SubRow[];
  const json = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (sub) => {
      const subscription: WebPushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };
      try {
        await webpush.sendNotification(subscription, json);
      } catch (err: unknown) {
        const status =
          typeof err === "object" && err !== null && "statusCode" in err
            ? (err as { statusCode?: number }).statusCode
            : undefined;
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
        } else {
          console.warn("[push] sendNotification failed", status, err);
        }
      }
    }),
  );
}
