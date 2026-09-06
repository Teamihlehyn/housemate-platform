"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";

interface Notif { id: string; title: string; body: string; eventName: string; createdAt: string; readAt: string | null; }

export default function Notifications() {
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ notifications: Notif[] }>("/notifications").then((d) => setItems(d.notifications)).finally(() => setLoading(false));
    api("/notifications", { body: {} }).catch(() => {}); // mark read
  }, []);

  if (loading) return <div className="space-y-2">{[0,1,2].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-stone-200" />)}</div>;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold text-stone-900">Notifications</h1>
      {items.length === 0 ? (
        <div className="card p-8 text-center text-sm text-stone-500">Nothing yet. We&apos;ll let you know when something happens.</div>
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <div key={n.id} className={`card p-4 ${!n.readAt ? "border-brand-200 bg-brand-50/40" : ""}`}>
              <div className="flex items-start justify-between">
                <p className="font-medium text-stone-900">{n.title}</p>
                <time className="text-xs text-stone-400">{new Date(n.createdAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</time>
              </div>
              <p className="mt-1 text-sm text-stone-600">{n.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
