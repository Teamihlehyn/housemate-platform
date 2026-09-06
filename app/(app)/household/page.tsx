"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiClientError } from "@/lib/client";
import { formatMoney, formatPeriodPrice, monthlyEquivalentMinor } from "@/lib/money";
import { formatDateRange } from "@/lib/dates";
import { CITIES } from "@/lib/constants";

const STAGES = ["planning", "viewing", "application", "move_in_pending"];
const STAGE_LABEL: Record<string, string> = {
  planning: "Planning", viewing: "Viewing", application: "Application", move_in_pending: "Move-in",
};

export default function HouseholdPage() {
  const [hh, setHh] = useState<any>(null);
  const [meId, setMeId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [me, cur] = await Promise.all([api<any>("/me"), api<any>("/households/current")]);
    setMeId(me.id);
    setHh(cur.household);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function call(fn: () => Promise<any>, okMsg?: string) {
    setMsg(null);
    try { await fn(); if (okMsg) setMsg(okMsg); await load(); }
    catch (e) { setMsg(e instanceof ApiClientError ? e.message : "Something went wrong."); }
  }

  if (loading) return <div className="h-64 animate-pulse rounded-xl bg-stone-200" />;

  if (!hh) return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      <p className="text-3xl">🏠</p>
      <h1 className="mt-3 text-xl font-bold text-stone-900">No active household</h1>
      <p className="mt-2 text-sm text-stone-600">Once you accept an introduction, you can propose forming a household from the chat.</p>
      <Link href="/messages" className="btn-primary mt-5">Go to messages</Link>
    </div>
  );

  const me = hh.members.find((m: any) => m.userId === meId);
  const other = hh.members.find((m: any) => m.userId !== meId);
  const plan = hh.currentPlan;
  const iAcceptedPlan = plan?.acceptedBy?.includes(meId);

  // ---------- Proposed state ----------
  if (hh.state === "proposed") {
    return (
      <div className="mx-auto max-w-lg">
        <StatusMsg msg={msg} />
        <div className="card p-6">
          <span className="chip bg-amber-100 text-amber-800">Proposal</span>
          <h1 className="mt-3 text-xl font-bold text-stone-900">Household with {other?.name}</h1>
          <PlanSummary plan={plan} members={hh.members} />
          <div className="mt-4">
            {iAcceptedPlan ? (
              <p className="rounded-lg bg-stone-50 p-3 text-sm text-stone-600">You&apos;ve accepted. Waiting for {other?.name} to accept the same plan.</p>
            ) : (
              <button className="btn-primary w-full" onClick={() => call(() => api(`/households/${hh.id}`, { body: { action: "accept", expected_version: hh.version, plan_version_id: plan.versionNo } }), "Household formed!")}>
                Accept &amp; form household
              </button>
            )}
            <button className="btn-ghost mt-2 w-full text-red-600" onClick={() => confirm("Leave this proposal?") && call(() => api(`/households/${hh.id}`, { body: { action: "leave" } }))}>Decline</button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Completed ----------
  if (hh.state === "completed") {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <p className="text-4xl">🎉</p>
        <h1 className="mt-3 text-xl font-bold text-stone-900">You&apos;ve moved in together!</h1>
        <p className="mt-2 text-sm text-stone-600">Both members confirmed the move-in for your household with {other?.name}. That completes the journey.</p>
        <PlanSummary plan={plan} members={hh.members} />
      </div>
    );
  }

  if (hh.state === "closed") {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <h1 className="text-xl font-bold text-stone-900">This household is closed</h1>
        <p className="mt-2 text-sm text-stone-600">You can return to searching from your profile.</p>
        <Link href="/profile" className="btn-secondary mt-4">Go to profile</Link>
      </div>
    );
  }

  // ---------- Active ----------
  const stageIdx = STAGES.indexOf(hh.derivedStage);
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "properties", label: "Properties" },
    { id: "viewings", label: "Viewings" },
    { id: "application", label: "Application" },
    { id: "movein", label: "Move-in" },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Household with {other?.name}</h1>
          <p className="text-sm text-stone-500">You &amp; {other?.name}</p>
        </div>
        <span className="chip bg-brand-100 text-brand-800">{STAGE_LABEL[hh.derivedStage]}</span>
      </div>

      {/* Stage progress */}
      <div className="mb-4 flex items-center gap-1">
        {STAGES.map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-1">
            <div className={`h-1.5 flex-1 rounded-full ${i <= stageIdx ? "bg-brand-500" : "bg-stone-200"}`} />
          </div>
        ))}
      </div>

      <StatusMsg msg={msg} />

      {/* Tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-stone-200">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${tab === t.id ? "border-brand-600 text-brand-700" : "border-transparent text-stone-500 hover:text-stone-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="card p-6">
          <PlanSummary plan={plan} members={hh.members} />
          <div className="mt-4 rounded-lg bg-stone-50 p-4 text-sm text-stone-600">
            <p className="font-medium text-stone-800">Next step</p>
            <p className="mt-1">{nextStepText(hh)}</p>
          </div>
          <button className="btn-ghost mt-4 text-sm text-red-600" onClick={() => confirm("Leaving closes the household for both of you and cancels viewings/application. Continue?") && call(() => api(`/households/${hh.id}`, { body: { action: "leave" } }))}>Leave household</button>
        </div>
      )}

      {tab === "properties" && <PropertiesTab hh={hh} meId={meId} onAction={call} />}
      {tab === "viewings" && <ViewingsTab hh={hh} meId={meId} onAction={call} />}
      {tab === "application" && <ApplicationTab hh={hh} meId={meId} onAction={call} />}
      {tab === "movein" && <MoveInTab hh={hh} meId={meId} onAction={call} />}
    </div>
  );
}

function StatusMsg({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <div className="mb-4 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm text-brand-800">{msg}</div>;
}

function nextStepText(hh: any) {
  if (hh.derivedStage === "planning") return "Shortlist a home you both like, then mark it interested to book a viewing.";
  if (hh.derivedStage === "viewing") return "Confirm your viewing time, then each report the outcome after visiting.";
  if (hh.derivedStage === "application") return "Both members consent to the rental handoff to submit the demo application.";
  if (hh.derivedStage === "move_in_pending") return "Confirm your move-in date to complete the journey.";
  return "";
}

function PlanSummary({ plan, members }: { plan: any; members: any[] }) {
  if (!plan) return null;
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg bg-stone-50 p-3 text-sm">
        <p className="text-stone-500">Move-in window</p>
        <p className="font-medium text-stone-900">{formatDateRange(plan.earliestDate, plan.latestDate)}</p>
      </div>
      <div className="rounded-lg bg-stone-50 p-3 text-sm">
        <p className="text-stone-500">Stay</p>
        <p className="font-medium text-stone-900">{plan.stayMin}–{plan.stayMax} months</p>
      </div>
      <div className="rounded-lg bg-stone-50 p-3 text-sm sm:col-span-2">
        <p className="text-stone-500">Contributions</p>
        {members.map((m: any) => (
          <p key={m.userId} className="font-medium text-stone-900">
            {m.name}: {formatMoney(plan.contributions[m.userId] ?? 0, plan.currency)} ({formatMoney(monthlyEquivalentMinor(plan.contributions[m.userId] ?? 0, "month"), plan.currency)}/mo)
          </p>
        ))}
      </div>
    </div>
  );
}

function PropertiesTab({ hh, meId, onAction }: { hh: any; meId: string; onAction: any }) {
  const [catalogue, setCatalogue] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => { api<any>("/properties").then((d) => setCatalogue(d.properties)).catch(() => {}); }, []);
  const shortlistedIds = new Set(hh.shortlist.map((s: any) => s.propertyId).filter(Boolean));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-stone-900">Shortlist</h2>
        <button className="btn-secondary text-sm" onClick={() => setShowAdd((s) => !s)}>{showAdd ? "Done" : "Add a home"}</button>
      </div>

      {hh.shortlist.length === 0 && <p className="card p-6 text-center text-sm text-stone-500">No homes shortlisted yet.</p>}

      {hh.shortlist.map((item: any) => {
        const myVote = item.votes.find((v: any) => v.userId === meId)?.decision;
        const prop = item.property;
        return (
          <div key={item.id} className="card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-stone-900">{item.title}</p>
                {prop && <p className="text-sm text-stone-500">{CITIES[prop.cityId as keyof typeof CITIES]?.areas.find((a) => a.id === prop.areaId)?.label} · Sample availability</p>}
                {item.url && <p className="text-xs text-stone-400">Details added by a member; availability unconfirmed</p>}
              </div>
              {item.bothInterested && <span className="chip bg-brand-100 text-brand-800">Both interested</span>}
            </div>
            {prop && (
              <div className="mt-2 text-sm text-stone-600">
                <p>{formatPeriodPrice(prop.rentMinor, prop.rentPeriod, prop.currency)} · {prop.bedroomCount}-bed {prop.contractType === "room" ? "(room)" : ""}</p>
                {prop.upfrontItems?.length > 0 && (
                  <p className="mt-1 text-xs text-amber-700">Upfront: {JSON.parse(typeof prop.upfrontItems === "string" ? prop.upfrontItems : JSON.stringify(prop.upfrontItems)).map((u: any) => `${u.label} ${formatMoney(u.minor, prop.currency)}`).join(", ")}</p>
                )}
              </div>
            )}
            <div className="mt-3 flex gap-2">
              {["interested", "not_interested"].map((d) => (
                <button key={d} onClick={() => onAction(() => api(`/shortlist/${item.id}/vote`, { body: { decision: d } }))}
                  className={`chip border ${myVote === d ? (d === "interested" ? "border-brand-500 bg-brand-100 text-brand-800" : "border-red-300 bg-red-50 text-red-700") : "border-stone-300 bg-white text-stone-600"}`}>
                  {d === "interested" ? "👍 Interested" : "👎 Not for me"}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {showAdd && (
        <div className="card p-5">
          <h3 className="font-semibold text-stone-900">Add from sample catalogue</h3>
          <div className="mt-3 space-y-2">
            {catalogue.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-stone-200 p-3">
                <div>
                  <p className="text-sm font-medium text-stone-900">{p.title}</p>
                  <p className="text-xs text-stone-500">{formatPeriodPrice(p.rentMinor, p.rentPeriod, p.currency)}</p>
                </div>
                <button className="btn-secondary text-sm" disabled={shortlistedIds.has(p.id)}
                  onClick={() => onAction(() => api(`/households/${hh.id}/shortlist`, { body: { source_property_id: p.id } }), "Added to shortlist")}>
                  {shortlistedIds.has(p.id) ? "Added" : "Add"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ViewingsTab({ hh, meId, onAction }: { hh: any; meId: string; onAction: any }) {
  const [slotFor, setSlotFor] = useState<string | null>(null);
  const [slot, setSlot] = useState("");
  const eligible = hh.shortlist.filter((s: any) => s.bothInterested);
  const tz = hh.currentPlan?.currency === "NGN" ? "Africa/Lagos" : "Europe/London";

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-stone-900">Viewings</h2>

      {eligible.length === 0 && hh.viewings.length === 0 && (
        <p className="card p-6 text-center text-sm text-stone-500">Both members must mark a home &quot;interested&quot; before booking a viewing.</p>
      )}

      {eligible.map((item: any) => {
        const existing = hh.viewings.find((v: any) => v.shortlistItemId === item.id && ["awaiting_partner", "confirmed", "completed", "disputed"].includes(v.state));
        return (
          <div key={item.id} className="card p-5">
            <p className="font-semibold text-stone-900">{item.title}</p>
            {!existing && (
              slotFor === item.id ? (
                <div className="mt-3 flex gap-2">
                  <input type="datetime-local" className="input" value={slot} onChange={(e) => setSlot(e.target.value)} />
                  <button className="btn-primary" disabled={!slot} onClick={() => { onAction(() => api(`/households/${hh.id}/viewings`, { body: { shortlist_item_id: item.id, starts_at: new Date(slot).toISOString(), timezone: tz } }), "Viewing proposed"); setSlotFor(null); }}>Propose</button>
                </div>
              ) : (
                <button className="btn-secondary mt-3 text-sm" onClick={() => setSlotFor(item.id)}>Propose a 30-min viewing</button>
              )
            )}
            {existing && <ViewingCard v={existing} meId={meId} onAction={onAction} tz={tz} />}
          </div>
        );
      })}
    </div>
  );
}

function ViewingCard({ v, meId, onAction, tz }: { v: any; meId: string; onAction: any; tz: string }) {
  const myOutcome = v.outcomes.find((o: any) => o.userId === meId);
  const when = new Date(v.startsAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: tz });
  return (
    <div className="mt-3 rounded-lg bg-stone-50 p-3 text-sm">
      <p className="text-stone-600">🗓 {when} <span className="text-xs text-stone-400">({tz})</span></p>
      <p className="mt-1"><span className="chip bg-white text-stone-600">{v.state.replace("_", " ")}</span></p>
      {v.state === "awaiting_partner" && v.proposedBy !== meId && (
        <button className="btn-primary mt-2 text-sm" onClick={() => onAction(() => api(`/viewings/${v.id}`, { body: { action: "accept", expected_version: v.version } }), "Viewing confirmed")}>Confirm this time</button>
      )}
      {v.state === "awaiting_partner" && v.proposedBy === meId && <p className="mt-2 text-xs text-stone-500">Waiting for your partner to confirm.</p>}
      {v.state === "confirmed" && !myOutcome && (
        <div className="mt-2 flex gap-2">
          <button className="btn-secondary text-sm" onClick={() => onAction(() => api(`/viewings/${v.id}`, { body: { action: "outcome", response: "completed", expected_version: v.version } }), "Outcome recorded")}>I attended ✓</button>
          <button className="btn-ghost text-sm" onClick={() => onAction(() => api(`/viewings/${v.id}`, { body: { action: "outcome", response: "no_show", expected_version: v.version } }))}>Couldn&apos;t make it</button>
        </div>
      )}
      {myOutcome && v.state === "confirmed" && <p className="mt-2 text-xs text-stone-500">You reported the outcome. Waiting for your partner.</p>}
      {v.state === "completed" && <p className="mt-2 text-xs text-brand-700">✓ Viewing completed by both.</p>}
      {v.state === "disputed" && <p className="mt-2 text-xs text-amber-700">Outcomes differ — resolve together before applying.</p>}
    </div>
  );
}

function ApplicationTab({ hh, meId, onAction }: { hh: any; meId: string; onAction: any }) {
  const handoff = hh.handoff;
  const hasCompletedViewing = hh.viewings.some((v: any) => v.state === "completed");

  if (!handoff || ["withdrawn", "rejected"].includes(handoff.state)) {
    return (
      <div className="card p-6">
        <h2 className="font-semibold text-stone-900">Rental handoff</h2>
        <p className="mt-2 text-sm text-stone-600">Start a demo application to the sample letting partner. You&apos;ll each consent to share your details. No home is reserved and there&apos;s no payment.</p>
        {!hasCompletedViewing && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">Tip: complete a viewing first, or acknowledge remote review to proceed.</p>}
        <button className="btn-primary mt-4" onClick={() => onAction(() => api(`/households/${hh.id}/handoffs`, { body: { remote_review_ack: true } }), "Application started")}>Start application</button>
      </div>
    );
  }

  const iConsented = handoff.acceptedBy.includes(meId);
  return (
    <div className="card p-6">
      <h2 className="font-semibold text-stone-900">Rental handoff</h2>
      <p className="mt-1 text-sm text-stone-500">Partner: {handoff.partnerId}</p>
      {handoff.state === "accepted" ? (
        <div className="mt-3 rounded-lg bg-brand-50 p-4 text-sm text-brand-800">
          ✅ Demo application accepted; no home is reserved. Head to Move-in to confirm.
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm text-stone-600">You&apos;ll share: display name, test contact, agreed dates, agreed contribution and verified check results — never your full evidence files or chat.</p>
          <div className="mt-3 flex items-center gap-2 text-sm">
            {hh.members.map((m: any) => (
              <span key={m.userId} className={`chip ${handoff.acceptedBy.includes(m.userId) ? "bg-brand-100 text-brand-800" : "bg-stone-100 text-stone-500"}`}>
                {m.name}: {handoff.acceptedBy.includes(m.userId) ? "consented" : "pending"}
              </span>
            ))}
          </div>
          {iConsented ? (
            <p className="mt-3 rounded-lg bg-stone-50 p-3 text-sm text-stone-600">You consented. Waiting for your partner to consent so the application can submit.</p>
          ) : (
            <button className="btn-primary mt-4" onClick={() => onAction(() => api(`/handoffs/${handoff.id}`, { body: { action: "consent", expected_version: handoff.version } }), "Consent recorded")}>Consent &amp; share my details</button>
          )}
          <button className="btn-ghost mt-2 text-sm text-red-600" onClick={() => onAction(() => api(`/handoffs/${handoff.id}`, { body: { action: "withdraw", expected_version: handoff.version } }))}>Withdraw application</button>
        </>
      )}
    </div>
  );
}

function MoveInTab({ hh, meId, onAction }: { hh: any; meId: string; onAction: any }) {
  const [date, setDate] = useState(hh.currentPlan?.earliestDate ?? "");
  const accepted = hh.handoff?.state === "accepted";
  const mine = hh.moveIns.find((m: any) => m.userId === meId);

  if (!accepted) return <div className="card p-6 text-sm text-stone-600">Complete an accepted rental handoff first.</div>;

  return (
    <div className="card p-6">
      <h2 className="font-semibold text-stone-900">Confirm move-in</h2>
      <p className="mt-1 text-sm text-stone-600">The household completes only after both members confirm. Elapsed time never confirms it for you.</p>
      <div className="mt-3 flex items-center gap-2 text-sm">
        {hh.members.map((m: any) => {
          const c = hh.moveIns.find((x: any) => x.userId === m.userId);
          return <span key={m.userId} className={`chip ${c?.response === "moved_in" ? "bg-brand-100 text-brand-800" : "bg-stone-100 text-stone-500"}`}>{m.name}: {c?.response ?? "pending"}</span>;
        })}
      </div>
      {mine?.response === "moved_in" ? (
        <p className="mt-3 rounded-lg bg-stone-50 p-3 text-sm text-stone-600">You confirmed your move-in. Waiting for your partner.</p>
      ) : (
        <div className="mt-4 flex gap-2">
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          <button className="btn-primary" disabled={!date} onClick={() => onAction(() => api(`/households/${hh.id}/move-in`, { body: { actual_date: date, response: "moved_in" } }), "Move-in confirmed")}>I&apos;ve moved in</button>
        </div>
      )}
    </div>
  );
}
