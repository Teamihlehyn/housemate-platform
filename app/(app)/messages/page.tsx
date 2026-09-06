"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api, ApiClientError } from "@/lib/client";

interface Intro {
  id: string; state: string; text?: string; otherName: string; otherInitials: string;
  isSender: boolean; conversationId: string | null; version: number;
}
interface Convo {
  id: string; otherName: string; otherInitials: string; lastMessage: string | null; status: string;
}

export default function Messages() {
  const [incoming, setIncoming] = useState<Intro[]>([]);
  const [outgoing, setOutgoing] = useState<Intro[]>([]);
  const [convos, setConvos] = useState<Convo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [inc, out, cv] = await Promise.all([
      api<{ introductions: Intro[] }>("/introductions?direction=incoming"),
      api<{ introductions: Intro[] }>("/introductions?direction=outgoing"),
      api<{ conversations: Convo[] }>("/conversations"),
    ]);
    setIncoming(inc.introductions.filter((i) => i.state === "pending"));
    setOutgoing(out.introductions.filter((i) => i.state === "pending"));
    setConvos(cv.conversations);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function act(intro: Intro, action: string) {
    setBusy(intro.id);
    try {
      await api(`/introductions/${intro.id}`, { body: { action, expected_version: intro.version } });
      await load();
    } catch (e) {
      alert(e instanceof ApiClientError ? e.message : "Failed");
    } finally { setBusy(null); }
  }

  if (loading) return <div className="space-y-3">{[0,1,2].map(i => <div key={i} className="h-20 animate-pulse rounded-xl bg-stone-200" />)}</div>;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold text-stone-900">Messages</h1>

      {incoming.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Introduction requests</h2>
          <div className="space-y-3">
            {incoming.map((i) => (
              <div key={i.id} className="card p-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-100 font-bold text-brand-700">{i.otherInitials}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-stone-900">{i.otherName}</p>
                    <p className="text-sm text-stone-600">{i.text}</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button className="btn-primary flex-1" disabled={busy === i.id} onClick={() => act(i, "accept")}>Accept</button>
                  <button className="btn-secondary flex-1" disabled={busy === i.id} onClick={() => act(i, "decline")}>Decline</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {outgoing.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Sent, awaiting reply</h2>
          <div className="space-y-2">
            {outgoing.map((i) => (
              <div key={i.id} className="card flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-stone-100 font-bold text-stone-600">{i.otherInitials}</span>
                  <p className="font-medium text-stone-800">{i.otherName}</p>
                </div>
                <button className="btn-ghost text-sm" disabled={busy === i.id} onClick={() => act(i, "withdraw")}>Withdraw</button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Conversations</h2>
        {convos.length === 0 ? (
          <div className="card p-8 text-center text-sm text-stone-600">
            No conversations yet. Accept an introduction to start chatting.
            <div className="mt-4"><Link href="/discover" className="btn-secondary">Find housemates</Link></div>
          </div>
        ) : (
          <div className="space-y-2">
            {convos.map((c) => (
              <Link key={c.id} href={`/messages/${c.id}`} className="card flex items-center gap-3 p-4 hover:bg-stone-50">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-100 font-bold text-brand-700">{c.otherInitials}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-stone-900">{c.otherName}</p>
                  <p className="truncate text-sm text-stone-500">{c.lastMessage ?? "Say hello 👋"}</p>
                </div>
                {c.status === "closed" && <span className="chip bg-stone-100 text-stone-500">Closed</span>}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
