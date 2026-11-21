"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { IconArrowRight } from "@/components/icons";

// Notifications (ENG-50): each card opens what it's about in one tap, and is marked read.
interface Notif {
  id: string; title: string; body: string; eventName: string; createdAt: string; readAt: string | null;
  target_type: string; href: string | null;
}

export default function Notifications() {
  const router = useRouter();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ notifications: Notif[] }>("/notifications").then((d) => setItems(d.notifications)).finally(() => setLoading(false));
  }, []);

  async function open(n: Notif) {
    await api(`/notifications/${n.id}/read`, { body: {} }).catch(() => {});
    setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, readAt: x.readAt ?? new Date().toISOString() } : x)));
    if (n.href) router.push(n.href);
  }
  async function markAll() {
    await api("/notifications", { body: {} }).catch(() => {});
    setItems((xs) => xs.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })));
  }

  if (loading) return <div className="mx-auto max-w-2xl space-y-2" aria-busy="true" aria-label="Loading notifications">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-20" />)}</div>;
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="font-display text-h1 text-ink">Notifications</h1>
        {unread > 0 && <button className="btn-ghost min-h-[44px] text-sm" onClick={markAll}>Mark all as read</button>}
      </div>
      {items.length === 0 ? (
        <div className="card p-8 text-center text-sm text-ink-600">Nothing yet. We&apos;ll let you know when something happens.</div>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const inner = (
              <>
                <span className="flex items-start justify-between gap-3">
                  <span className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                    {!n.readAt && <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">New</span>}
                    {n.title}
                  </span>
                  <time className="shrink-0 text-xs text-ink-600">{new Date(n.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>
                </span>
                <span className="mt-1 block text-sm text-ink-700">{n.body}</span>
                {n.href && <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-700" aria-hidden="true">Open <IconArrowRight size={14} /></span>}
              </>
            );
            const cls = `card block w-full p-4 text-left transition duration-quick focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${!n.readAt ? "border-brand-200 bg-brand-50" : ""}`;
            return (
              <li key={n.id}>
                {n.href ? (
                  <button type="button" className={`${cls} min-h-[44px] hover:bg-cream`} onClick={() => open(n)}>{inner}</button>
                ) : (
                  <div className={cls}>{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
