"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { playNotifSound } from "@/lib/notification-sound";

export type ChatMessage = {
  id: string;
  expediteur_id: string;
  contenu: string;
  envoye_le: string;
  lu: boolean;
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Aujourd'hui";
  if (sameDay(d, yesterday)) return "Hier";
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function ChatView({
  reservationId,
  currentUserId,
  otherUserId,
  initialMessages,
}: {
  reservationId: string;
  currentUserId: string;
  otherUserId: string;
  initialMessages: ChatMessage[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => {
    const channel = supabase
      .channel(`messages-${reservationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `reservation_id=eq.${reservationId}`,
        },
        (payload) => {
          const m = payload.new as ChatMessage;
          setMessages((prev) =>
            prev.some((p) => p.id === m.id) ? prev : [...prev, m],
          );
          if (m.expediteur_id !== currentUserId) {
            void playNotifSound("message");
            void supabase
              .from("messages")
              .update({ lu: true })
              .eq("id", m.id)
              .eq("destinataire_id", currentUserId);
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [reservationId, currentUserId, supabase]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const contenu = draft.trim();
    if (!contenu) return;
    if (contenu.length > 2000) {
      toast.error("Message trop long (max 2000 caractères)");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservation_id: reservationId,
          destinataire_id: otherUserId,
          contenu,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? "Échec de l'envoi");
        return;
      }
      setDraft("");
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setSending(false);
    }
  }

  // Group by day
  const grouped: Array<{ label: string; items: ChatMessage[] }> = [];
  for (const m of messages) {
    const label = formatDateLabel(m.envoye_le);
    const last = grouped[grouped.length - 1];
    if (last && last.label === label) {
      last.items.push(m);
    } else {
      grouped.push({ label, items: [m] });
    }
  }

  return (
    <div className="flex flex-1 flex-col rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div
        ref={scrollRef}
        className="min-h-[50vh] max-h-[60vh] flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-center text-sm text-slate-500">
              Aucun message pour le moment.
              <br />
              Démarre la conversation 👋
            </p>
          </div>
        ) : (
          grouped.map((group, gi) => (
            <div key={gi} className="space-y-2">
              <div className="flex justify-center">
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:bg-slate-800">
                  {group.label}
                </span>
              </div>
              {group.items.map((m) => {
                const mine = m.expediteur_id === currentUserId;
                return (
                  <div
                    key={m.id}
                    className={`flex ${mine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                        mine
                          ? "rounded-br-sm bg-emerald-600 text-white"
                          : "rounded-bl-sm bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">
                        {m.contenu}
                      </p>
                      <p
                        className={`mt-0.5 text-right text-[10px] ${
                          mine
                            ? "text-emerald-100"
                            : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {formatTime(m.envoye_le)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      <form
        onSubmit={send}
        className="flex items-end gap-2 border-t border-slate-200 p-3 dark:border-slate-700"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(e as unknown as React.FormEvent);
            }
          }}
          placeholder="Ton message…"
          rows={1}
          maxLength={2000}
          className="flex-1 resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition"
          aria-label="Envoyer"
        >
          {sending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </button>
      </form>
    </div>
  );
}
