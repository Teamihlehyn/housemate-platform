"use client";

import { use, useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError, newIdempotencyKey } from "@/lib/client";
import ReportDialog from "@/components/ReportDialog";
import Pea from "@/components/brand/Pea";
import { IconBack, IconHome, IconSend } from "@/components/icons";

interface Msg { id: string; sequence: number; body: string; mine: boolean; sentAt: string; pending?: boolean; failed?: boolean; clientMessageId?: string; }

export default function Chat({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [meta, setMeta] = useState<{ status: string; otherName: string; otherInitials: string; introductionId: string; otherUserId: string; otherIsSample?: boolean } | null>(null);
  const [reporting, setReporting] = useState(false);
  const [text, setText] = useState("");
  const [caution, setCaution] = useState(false);
  const [showHousehold, setShowHousehold] = useState(false);
  const lastSeq = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const poll = useCallback(async () => {
    try {
      const d = await api<any>(`/conversations/${id}/messages?after_sequence=${lastSeq.current}`);
      setMeta({ status: d.status, otherName: d.otherName, otherInitials: d.otherInitials, introductionId: d.introductionId, otherUserId: d.otherUserId, otherIsSample: d.otherIsSample });
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

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [messages]);

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
    <div data-no-bottom-nav style={{ top: "calc(var(--banner-h, 33px) + 61px)" }} className="fixed inset-x-0 bottom-0 z-30 flex flex-col bg-paper md:static md:z-auto md:mx-auto md:h-[calc(100dvh-10rem)] md:max-w-2xl md:bg-transparent">
      {/* Header: who, plus Report and Block always one tap away */}
      <div className="border-b border-ink-100 bg-paper px-2 pb-2 pt-1.5 md:card md:mb-3 md:px-3 md:pt-3">
        <div className="flex items-center gap-2">
          <button className="btn-icon" onClick={() => router.push("/messages")} aria-label="Back to messages">
            <IconBack size={22} />
          </button>
          <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-lilac-100 font-bold text-lilac-800">{meta?.otherInitials}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-ink">{meta?.otherName ?? "…"}</p>
            {meta?.otherIsSample && <p className="truncate text-xs text-ink-600">Sample housemate · replies automatically</p>}
          </div>
        </div>
        <div className="mt-1.5 grid grid-cols-[auto_1fr_1fr] gap-1.5 sm:flex sm:justify-end">
          <button className="btn-secondary whitespace-nowrap px-3 text-sm" onClick={() => setShowHousehold(true)}>
            <IconHome size={16} /> Form household
          </button>
          <button className="btn-ghost px-3 text-sm" onClick={() => setReporting(true)}>Report</button>
          <button className="btn-ghost px-3 text-sm text-danger-600 hover:bg-danger-50" onClick={block}>Block</button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-2 overflow-y-auto overscroll-contain bg-cream px-3 py-4 md:rounded-card md:border md:border-ink-100 md:bg-white md:px-4">
        {messages.length === 0 && (
          <div className="mt-8 flex flex-col items-center gap-2 text-center text-sm text-ink-600">
            <Pea size={56} mood="awake" blink />
            No messages yet. Say hello.
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-panel px-3.5 py-2 text-body ${m.mine ? "rounded-br-md bg-brand-700 text-cream" : "rounded-bl-md border border-ink-100 bg-white text-ink"} ${m.pending ? "opacity-70" : ""}`}>
              <p className="whitespace-pre-wrap break-words" data-clarity-mask="true" dangerouslySetInnerHTML={{ __html: m.body }} />
              {m.pending && <span className="mt-0.5 block text-xs">Sending…</span>}
              {m.failed && <span className="mt-0.5 block text-xs font-semibold">Not sent. Check your connection and send it again.</span>}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {caution && (
        <div role="status" className="mx-3 mt-2 rounded-field border border-caution-200 bg-caution-50 px-3 py-2 text-sm text-caution-800 md:mx-0">
          That message mentions sending money. Never pay anyone before you&apos;ve seen a home in person. You can report anything that feels off.
        </div>
      )}

      {/* Composer */}
      {meta?.status === "closed" ? (
        <div className="m-3 rounded-field bg-ink-50 p-3 text-center text-sm text-ink-700 md:mx-0">This conversation is closed.</div>
      ) : (
        <form className="flex items-end gap-2 border-t border-ink-100 bg-paper px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-2.5 md:mt-3 md:border-0 md:bg-transparent md:px-0 md:pb-0" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <label htmlFor="composer" className="sr-only">Message {meta?.otherName}</label>
          <input id="composer" className="input rounded-full" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" maxLength={2000} autoComplete="off" data-clarity-mask="true" />
          <button className="btn-primary h-12 w-12 shrink-0 px-0" aria-label="Send message" disabled={!text.trim()}>
            <IconSend size={20} />
          </button>
        </form>
      )}

      {reporting && meta && (
        <ReportDialog targetUserId={meta.otherUserId} targetName={meta.otherName} conversationId={id} onClose={() => setReporting(false)} />
      )}

      {showHousehold && meta && (
        <div className="fixed inset-0 z-50 grid items-end bg-black/40 sm:place-items-center sm:p-4" onClick={() => setShowHousehold(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="hh-title" className="w-full animate-sheet-in rounded-t-sheet bg-white p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] sm:max-w-md sm:rounded-sheet sm:p-6" onClick={(e) => e.stopPropagation()}>
            <h2 id="hh-title" className="text-h2 text-ink">Form a household with {meta.otherName}?</h2>
            <p className="mt-2 text-sm text-ink-600">
              This proposes a two-person household using your overlapping move-in window. Next you&apos;ll agree the
              rent split, bills and notice period in writing. {meta.otherName} must accept before it becomes active.
            </p>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row">
              <button className="btn-secondary flex-1" onClick={() => setShowHousehold(false)}>Cancel</button>
              <button className="btn-primary flex-1" onClick={formHousehold}>Propose household</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
