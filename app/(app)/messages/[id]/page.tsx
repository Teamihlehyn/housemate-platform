"use client";

import { use, useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError, newIdempotencyKey } from "@/lib/client";

interface Msg { id: string; sequence: number; body: string; mine: boolean; sentAt: string; pending?: boolean; failed?: boolean; clientMessageId?: string; }

export default function Chat({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [meta, setMeta] = useState<{ status: string; otherName: string; otherInitials: string; introductionId: string; otherUserId: string } | null>(null);
  const [text, setText] = useState("");
  const [caution, setCaution] = useState(false);
  const [showHousehold, setShowHousehold] = useState(false);
  const lastSeq = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const poll = useCallback(async () => {
    try {
      const d = await api<any>(`/conversations/${id}/messages?after_sequence=${lastSeq.current}`);
      setMeta({ status: d.status, otherName: d.otherName, otherInitials: d.otherInitials, introductionId: d.introductionId, otherUserId: d.otherUserId });
      if (d.messages.length > 0) {
        setMessages((prev) => {
          // drop any pending that now have a confirmed twin (by clientMessageId)
          const confirmedClientIds = new Set(d.messages.map((m: any) => m.clientMessageId));
          const kept = prev.filter((m) => !(m.pending && confirmedClientIds.has(m.clientMessageId)));
          const existingSeqs = new Set(kept.map((m) => m.sequence));
          const added = d.messages.filter((m: any) => !existingSeqs.has(m.sequence));
          return [...kept, ...added].sort((a, b) => (a.sequence || 1e9) - (b.sequence || 1e9));
        });
        lastSeq.current = Math.max(lastSeq.current, ...d.messages.map((m: any) => m.sequence));
      }
    } catch { /* offline / transient */ }
  }, [id]);

  useEffect(() => {
    poll();
    const t = setInterval(poll, 2000);
    return () => clearInterval(t);
  }, [poll]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send() {
    const bodyText = text.trim();
    if (!bodyText) return;
    const clientMessageId = newIdempotencyKey();
    setText("");
    setCaution(false);
    setMessages((p) => [...p, { id: clientMessageId, sequence: 0, body: bodyText, mine: true, sentAt: new Date().toISOString(), pending: true, clientMessageId }]);
    try {
      const res = await api<{ caution?: boolean }>(`/conversations/${id}/messages`, { body: { client_message_id: clientMessageId, body: bodyText } });
      if (res.caution) setCaution(true);
      poll();
    } catch (e) {
      setMessages((p) => p.map((m) => (m.clientMessageId === clientMessageId ? { ...m, pending: false, failed: true } : m)));
    }
  }

  async function formHousehold() {
    if (!meta) return;
    try {
      const res = await api<{ id: string }>("/households", { body: { introduction_id: meta.introductionId, plan: {} } });
      router.push("/household");
    } catch (e) {
      alert(e instanceof ApiClientError ? e.message : "Could not create household.");
    }
  }
  async function block() {
    if (!meta) return;
    if (!confirm("Block this member? Immediate and bilateral.")) return;
    await api("/blocks", { body: { target_user_id: meta.otherUserId } });
    router.push("/messages");
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col" style={{ height: "calc(100vh - 9rem)" }}>
      {/* Header */}
      <div className="card mb-3 flex items-center justify-between p-3">
        <div className="flex items-center gap-3">
          <button className="btn-ghost px-2" onClick={() => router.push("/messages")}>←</button>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 font-bold text-brand-700">{meta?.otherInitials}</span>
          <p className="font-semibold text-stone-900">{meta?.otherName ?? "…"}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary px-3 py-1.5 text-sm" onClick={() => setShowHousehold(true)}>Form household</button>
          <button className="btn-ghost px-2 text-sm text-red-600" onClick={block}>Block</button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-2 overflow-y-auto rounded-xl border border-stone-200 bg-white p-4">
        {messages.length === 0 && <p className="mt-8 text-center text-sm text-stone-400">No messages yet. Say hello 👋</p>}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${m.mine ? "bg-brand-600 text-white" : "bg-stone-100 text-stone-800"}`}>
              <p className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: m.body }} />
              {m.pending && <span className="mt-0.5 block text-[10px] opacity-70">Sending…</span>}
              {m.failed && <span className="mt-0.5 block text-[10px] text-red-200">Failed — tap to retry</span>}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {caution && (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          ⚠️ That message mentions sending money. Be cautious — you can report anything that feels off.
        </div>
      )}

      {/* Composer */}
      {meta?.status === "closed" ? (
        <div className="mt-3 rounded-lg bg-stone-100 p-3 text-center text-sm text-stone-500">This conversation is closed.</div>
      ) : (
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" maxLength={2000} />
          <button className="btn-primary" disabled={!text.trim()}>Send</button>
        </form>
      )}

      {showHousehold && meta && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setShowHousehold(false)}>
          <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-stone-900">Form a household with {meta.otherName}?</h2>
            <p className="mt-2 text-sm text-stone-600">
              This proposes a two-person household using your overlapping move-in window and each person&apos;s
              budget as the default contribution. {meta.otherName} must accept before it becomes active.
            </p>
            <div className="mt-4 flex gap-2">
              <button className="btn-secondary flex-1" onClick={() => setShowHousehold(false)}>Cancel</button>
              <button className="btn-primary flex-1" onClick={formHousehold}>Propose household</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
