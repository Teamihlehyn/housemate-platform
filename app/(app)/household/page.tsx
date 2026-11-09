"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiClientError } from "@/lib/client";
import { formatMoney, formatPeriodPrice } from "@/lib/money";
import { formatDateRange } from "@/lib/dates";
import { CITIES } from "@/lib/constants";
import Pea from "@/components/brand/Pea";
import { IconCalendar, IconCheck } from "@/components/icons";

// Beta has no homes, viewings, application or move-in (those APIs 404 there): the household
// is the written agreement only.
const IS_BETA = process.env.NEXT_PUBLIC_APP_ENV === "beta";

const STAGES = ["planning", "viewing", "application", "move_in_pending"];
const STAGE_LABEL: Record<string, string> = {
  planning: "Planning", viewing: "Viewing", application: "Application", move_in_pending: "Move-in",
  needs_reagreement: "Re-agree plan",
};
const NOTICE_OPTIONS = [
  { weeks: 2, label: "2 weeks" },
  { weeks: 4, label: "4 weeks (about a month)" },
  { weeks: 6, label: "6 weeks" },
  { weeks: 8, label: "8 weeks (about 2 months)" },
  { weeks: 12, label: "12 weeks (about 3 months)" },
];
const BILLS_LABEL: Record<string, string> = {
  equal: "Split equally",
  same_as_rent: "Same ratio as rent",
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

  async function call(fn: () => Promise<any>, okMsg?: string): Promise<boolean> {
    setMsg(null);
    try { await fn(); if (okMsg) setMsg(okMsg); await load(); return true; }
    catch (e) { setMsg(e instanceof ApiClientError ? e.message : "Something went wrong."); return false; }
  }

  if (loading) return <div className="skeleton mx-auto h-64 max-w-3xl" />;

  if (!hh) return (
    <div className="card mx-auto max-w-lg p-6 text-center sm:p-8">
      <div className="flex justify-center gap-0.5" aria-hidden="true"><Pea size={56} mood="awake" blink /><Pea size={56} mood="sleep" tone="fresh" dim /></div>
      <h1 className="mt-3 text-h2 text-ink">No household yet</h1>
      <p className="mt-2 text-sm text-ink-600">Once someone accepts your introduction, use &quot;Form household&quot; in your chat with them. Then you&apos;ll agree rent split, bills and notice here.</p>
      <Link href="/messages" className="btn-primary mt-5">Go to messages</Link>
    </div>
  );

  const other = hh.members.find((m: any) => m.userId !== meId);
  const plan = hh.currentPlan;
  const iAcceptedPlan = plan?.acceptedBy?.includes(meId);
  const acceptPlan = () =>
    call(() => api(`/households/${hh.id}`, { body: { action: hh.state === "proposed" ? "accept" : "accept_plan", plan_version_id: plan.versionNo } }),
      hh.state === "proposed" ? "Household formed!" : "Agreement accepted.");

  // ---------- Proposed state ----------
  if (hh.state === "proposed") {
    return (
      <div className="mx-auto max-w-2xl">
        <StatusMsg msg={msg} />
        <div className="mb-4">
          <span className="chip bg-caution-50 text-caution-800">Proposal</span>
          <h1 className="mt-2 font-display text-h1 text-ink">Household with {other?.name} <SampleChip member={other} /></h1>
        </div>
        <AgreementCard hh={hh} meId={meId} onAction={call} onAccept={acceptPlan} />
        {!iAcceptedPlan && (
          <button className="btn-ghost mt-3 w-full text-danger-600 hover:bg-danger-50" onClick={() => confirm("Decline this household proposal? You can keep chatting.") && call(() => api(`/households/${hh.id}`, { body: { action: "leave" } }))}>Decline proposal</button>
        )}
      </div>
    );
  }

  // ---------- Completed ----------
  if (hh.state === "completed") {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="card mb-4 p-6 text-center sm:p-8">
          <div className="flex justify-center gap-0.5" aria-hidden="true"><Pea size={64} mood="happy" className="animate-bob" /><Pea size={64} mood="wink" tone="fresh" className="animate-bob-slow" /></div>
          <h1 className="mt-3 text-h2 text-ink">You&apos;ve moved in together!</h1>
          <p className="mt-2 text-sm text-ink-600">Both of you confirmed the move-in with {other?.name}. That completes the journey.</p>
        </div>
        <AgreementCard hh={hh} meId={meId} onAction={call} readOnly />
      </div>
    );
  }

  if (hh.state === "closed") {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <h1 className="text-xl font-bold text-ink">This household is closed</h1>
        <p className="mt-2 text-sm text-ink-600">You can return to searching from your profile.</p>
        <Link href="/profile" className="btn-secondary mt-4">Go to profile</Link>
      </div>
    );
  }

  // ---------- Active ----------
  const stageIdx = STAGES.indexOf(hh.derivedStage);
  const tabs = [
    { id: "overview", label: "Agreement" },
    { id: "properties", label: "Homes" },
    { id: "viewings", label: "Viewings" },
    { id: "application", label: "Application" },
    { id: "movein", label: "Move-in" },
  ];
  const leave = () =>
    confirm(IS_BETA ? "Leaving closes the household for both of you. Continue?" : "Leaving closes the household for both of you and cancels viewings and the application. Continue?") &&
    call(() => api(`/households/${hh.id}`, { body: { action: "leave" } }));

  if (IS_BETA) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-display text-h1 text-ink md:text-h1-md">Household with {other?.name} <SampleChip member={other} /></h1>
          {plan?.agreed ? (
            <span className="chip shrink-0 bg-brand-100 text-brand-800"><IconCheck size={14} strokeWidth={2.5} /> Agreement in place</span>
          ) : (
            <span className="chip shrink-0 bg-caution-50 text-caution-800">Needs both to accept</span>
          )}
        </div>
        <StatusMsg msg={msg} />
        <AgreementCard hh={hh} meId={meId} onAction={call} onAccept={acceptPlan} />
        {!plan?.agreed && (
          <p className="mt-4 rounded-panel bg-cream p-4 text-sm text-ink-700">Both of you need to accept the latest version. Changing anything creates a new version.</p>
        )}
        <button className="btn-ghost mt-3 text-sm text-danger-600 hover:bg-danger-50" onClick={leave}>Leave household</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-h1 text-ink md:text-h1-md">Household with {other?.name} <SampleChip member={other} /></h1>
          <p className="text-sm text-ink-600">Agree how you&apos;ll live together, then find a home.</p>
        </div>
        <span className={`chip shrink-0 ${hh.derivedStage === "needs_reagreement" ? "bg-caution-50 text-caution-800" : "bg-brand-100 text-brand-800"}`}>Stage: {STAGE_LABEL[hh.derivedStage]}</span>
      </div>

      <ol className="mb-4 grid grid-cols-4 gap-1" aria-label="Household progress">
        {STAGES.map((s, i) => (
          <li key={s} aria-current={i === stageIdx ? "step" : undefined} className="text-center">
            <div className={`h-1.5 rounded-full ${stageIdx >= 0 && i < stageIdx ? "bg-ink" : i === stageIdx ? "bg-pea-500" : "bg-ink-100"}`} />
            <span className={`mt-1 block text-[11px] ${i === stageIdx ? "font-semibold text-ink" : "text-ink-600"}`}>{STAGE_LABEL[s]}</span>
          </li>
        ))}
      </ol>

      <StatusMsg msg={msg} />

      <div className="-mx-4 mb-4 overflow-x-auto px-4 [scrollbar-width:none]">
        <div role="tablist" aria-label="Household sections" className="flex w-max gap-1.5">
          {tabs.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
              className={`min-h-[44px] whitespace-nowrap rounded-full px-4 text-sm font-semibold transition duration-quick focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${tab === t.id ? "bg-ink text-cream" : "bg-white text-ink-700 ring-1 ring-ink-100 hover:bg-ink-50"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" && (
        <>
          <AgreementCard hh={hh} meId={meId} onAction={call} onAccept={acceptPlan} />
          <div className="card mt-4 p-5 text-sm text-ink-600">
            <p className="font-medium text-ink">Next step</p>
            <p className="mt-1">{nextStepText(hh)}</p>
          </div>
          <button className="btn-ghost mt-3 text-sm text-danger-600 hover:bg-danger-50" onClick={leave}>Leave household</button>
        </>
      )}

      {tab === "properties" && <PropertiesTab hh={hh} meId={meId} onAction={call} />}
      {tab === "viewings" && <AgreedGate hh={hh} onOpen={() => setTab("overview")}><ViewingsTab hh={hh} meId={meId} onAction={call} /></AgreedGate>}
      {tab === "application" && <AgreedGate hh={hh} onOpen={() => setTab("overview")}><ApplicationTab hh={hh} meId={meId} onAction={call} /></AgreedGate>}
      {tab === "movein" && <MoveInTab hh={hh} meId={meId} onAction={call} />}
    </div>
  );
}

function SampleChip({ member }: { member: any }) {
  if (!member?.isSample) return null;
  return <span className="chip-sample ml-1 align-middle">Sample housemate · replies automatically</span>;
}

function StatusMsg({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <div className="mb-4 rounded-field border border-ink-100 bg-white px-4 py-2.5 text-sm font-medium text-ink" role="status">{msg}</div>;
}

function AgreedGate({ hh, onOpen, children }: { hh: any; onOpen: () => void; children: React.ReactNode }) {
  if (hh.currentPlan?.agreed) return <>{children}</>;
  return (
    <div className="card p-6 text-sm text-ink-600">
      <p className="font-medium text-ink">Agree your plan first</p>
      <p className="mt-1">Your household agreement changed. Both of you need to accept the latest version before booking viewings or applying.</p>
      <button className="btn-secondary mt-3" onClick={onOpen}>Review the agreement</button>
    </div>
  );
}

function nextStepText(hh: any) {
  if (!hh.currentPlan?.agreed) return "Both of you need to accept the latest agreement before you can book viewings or apply.";
  if (hh.derivedStage === "planning") return "Check the agreement looks right, then go to Homes: shortlist a place you both like and book a viewing.";
  if (hh.derivedStage === "viewing") return "Confirm your viewing time, then each report how it went.";
  if (hh.derivedStage === "application") return "Both of you consent to the demo application to submit it.";
  if (hh.derivedStage === "move_in_pending") return "Confirm your move-in date to complete the journey.";
  return "";
}

function money(minor: number, currency: string) {
  return formatMoney(minor, currency);
}

function AgreementCard({ hh, meId, onAction, onAccept, readOnly }: { hh: any; meId: string; onAction: any; onAccept?: () => void; readOnly?: boolean }) {
  const [editing, setEditing] = useState(false);
  const plan = hh.currentPlan;
  if (!plan) return null;
  const members: any[] = hh.members.filter((m: any) => m.state === "active");
  const total = members.reduce((sum, m) => sum + (plan.contributions[m.userId] ?? 0), 0);
  const iAccepted = plan.acceptedBy.includes(meId);
  const waitingFor = members.filter((m) => !plan.acceptedBy.includes(m.userId));

  if (editing) return <AgreementEditor hh={hh} onCancel={() => setEditing(false)} onSaved={() => setEditing(false)} onAction={onAction} />;

  return (
    <div className="card p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-h2 text-ink">Household agreement</h2>
          <p className="text-caption text-ink-600">Version {plan.versionNo} · a record of what you both agreed, not a tenancy or legal contract</p>
        </div>
        {plan.agreed ? (
          <span className="chip shrink-0 bg-brand-100 text-brand-800">✓ Agreed by both</span>
        ) : (
          <span className="chip shrink-0 bg-caution-50 text-caution-800">Waiting for {waitingFor.map((m) => (m.userId === meId ? "you" : m.name.split(" ")[0])).join(" & ")}</span>
        )}
      </div>

      <dl className="mt-5 space-y-4 text-sm">
        <div>
          <dt className="text-ink-600">Rent split (per month)</dt>
          <dd className="mt-1 space-y-1">
            {members.map((m) => {
              const c = plan.contributions[m.userId] ?? 0;
              const pct = total > 0 ? Math.round((c / total) * 100) : 0;
              return (
                <div key={m.userId} className="flex items-center justify-between gap-2">
                  <span className="text-ink-700">{m.userId === meId ? "You" : m.name}</span>
                  <span className="num font-semibold text-ink">
                    {money(c, plan.currency)}/mo <span className="font-normal text-ink-500">· {pct}%</span>
                    {plan.currency === "NGN" && <span className="block text-right text-xs font-normal text-ink-500">≈ {money(c * 12, plan.currency)}/yr</span>}
                  </span>
                </div>
              );
            })}
            <div className="flex justify-between border-t border-ink-100 pt-1 text-ink-600">
              <span>Total rent you can cover</span>
              <span>{money(total, plan.currency)}/mo</span>
            </div>
          </dd>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div><dt className="text-ink-600">Bills</dt><dd className="font-medium text-ink">{BILLS_LABEL[plan.billsSplit] ?? plan.billsSplit}</dd></div>
          <div><dt className="text-ink-600">Notice if someone leaves</dt><dd className="font-medium text-ink">{NOTICE_OPTIONS.find((n) => n.weeks === plan.noticePeriodWeeks)?.label ?? `${plan.noticePeriodWeeks} weeks`}</dd></div>
          <div><dt className="text-ink-600">Stay</dt><dd className="font-medium text-ink">{plan.stayMin}–{plan.stayMax} months</dd></div>
        </div>
        <div><dt className="text-ink-600">Move-in window</dt><dd className="font-medium text-ink">{formatDateRange(plan.earliestDate, plan.latestDate)}</dd></div>
        {plan.notes && (
          <div><dt className="text-ink-600">Also agreed</dt><dd className="whitespace-pre-wrap text-ink">{plan.notes}</dd></div>
        )}
      </dl>

      {!readOnly && (
        <div className="mt-5 flex flex-wrap gap-2 border-t border-ink-100 pt-4">
          {!iAccepted && onAccept && (
            <button className="btn-confirm" onClick={onAccept}>{hh.state === "proposed" ? "Accept & form household" : `Accept version ${plan.versionNo}`}</button>
          )}
          <button className="btn-secondary" onClick={() => setEditing(true)}>Edit agreement</button>
        </div>
      )}
      {!readOnly && iAccepted && !plan.agreed && (
        <p className="mt-3 text-xs text-ink-600">You&apos;ve accepted this version. Changing anything creates a new version that both of you accept again.</p>
      )}
    </div>
  );
}

function AgreementEditor({ hh, onCancel, onSaved, onAction }: { hh: any; onCancel: () => void; onSaved: () => void; onAction: any }) {
  const plan = hh.currentPlan;
  const members: any[] = hh.members.filter((m: any) => m.state === "active");
  const [amounts, setAmounts] = useState<Record<string, string>>(
    Object.fromEntries(members.map((m) => [m.userId, String(Math.round((plan.contributions[m.userId] ?? 0) / 100))]))
  );
  const [notice, setNotice] = useState<number>(plan.noticePeriodWeeks);
  const [bills, setBills] = useState<string>(plan.billsSplit);
  const [stayMin, setStayMin] = useState(String(plan.stayMin));
  const [stayMax, setStayMax] = useState(String(plan.stayMax));
  const [notes, setNotes] = useState<string>(plan.notes ?? "");
  const [saving, setSaving] = useState(false);
  const symbol = plan.currency === "NGN" ? "₦" : "£";
  const parsed: Record<string, number> = Object.fromEntries(
    members.map((m) => [m.userId, Math.round(parseFloat(amounts[m.userId] || "0") * 100)])
  );
  const total: number = Object.values(parsed).reduce((a: number, b: number) => a + (Number.isFinite(b) ? b : 0), 0);

  async function save() {
    setSaving(true);
    const saved = await onAction(
      () => api(`/households/${hh.id}/plan`, {
        method: "PATCH",
        body: {
          expected_plan_version: plan.versionNo,
          contributions: parsed,
          noticePeriodWeeks: notice,
          billsSplit: bills,
          notes,
          stayMin: parseInt(stayMin, 10),
          stayMax: parseInt(stayMax, 10),
        },
      }),
      "New version saved. Your housemate needs to accept it."
    );
    setSaving(false);
    if (saved) onSaved();
    else window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="card p-4 sm:p-6">
      <h2 className="text-h2 text-ink">Edit agreement</h2>
      <p className="text-sm text-ink-600">Saving creates version {plan.versionNo + 1}. Your housemate will be asked to accept it.</p>

      <fieldset className="mt-5">
        <legend className="label">How much rent will each of you pay per month?</legend>
        <div className="space-y-3">
          {members.map((m) => {
            const v = parsed[m.userId];
            const band = m.rentBand;
            const outside = band && Number.isFinite(v) && (v < band.minMonthly || v > band.maxMonthly);
            return (
              <div key={m.userId}>
                <div className="flex items-center gap-3">
                  <label className="w-20 shrink-0 truncate text-sm text-ink-700 sm:w-28" htmlFor={`c-${m.userId}`}>{m.name.split(" ")[0]}</label>
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-600">{symbol}</span>
                    <input id={`c-${m.userId}`} inputMode="decimal" className="input num pl-8" value={amounts[m.userId]}
                      onChange={(e) => setAmounts((a) => ({ ...a, [m.userId]: e.target.value.replace(/[^\d.]/g, "") }))} />
                  </div>
                  <span className="num w-10 shrink-0 text-right text-sm text-ink-600">{total > 0 && Number.isFinite(v) ? Math.round((v / total) * 100) : 0}%</span>
                </div>
                {outside && (
                  <p className="ml-[5.75rem] mt-1 text-sm text-caution-800 sm:ml-[7.75rem]">
                    Outside {m.name.split(" ")[0]}&apos;s saved budget ({formatMoney(band.minMonthly, plan.currency)}–{formatMoney(band.maxMonthly, plan.currency)}/mo).
                  </p>
                )}
              </div>
            );
          })}
          <p className="text-sm text-ink-600">Total: <span className="font-medium text-ink">{formatMoney(total, plan.currency)}/mo</span>{plan.currency === "NGN" && <> · ≈ {formatMoney(total * 12, plan.currency)}/yr</>}</p>
        </div>
      </fieldset>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="bills">Bills</label>
          <select id="bills" className="input" value={bills} onChange={(e) => setBills(e.target.value)}>
            {Object.entries(BILLS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="notice">Notice if someone leaves</label>
          <select id="notice" className="input" value={notice} onChange={(e) => setNotice(parseInt(e.target.value, 10))}>
            {NOTICE_OPTIONS.map((n) => <option key={n.weeks} value={n.weeks}>{n.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="smin">Minimum stay (months)</label>
          <input id="smin" inputMode="numeric" className="input" value={stayMin} onChange={(e) => setStayMin(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="smax">Maximum stay (months)</label>
          <input id="smax" inputMode="numeric" className="input" value={stayMax} onChange={(e) => setStayMax(e.target.value)} />
        </div>
      </div>

      <div className="mt-5">
        <label className="label" htmlFor="notes">Anything else you want in writing? <span className="font-normal text-ink-500">(optional)</span></label>
        <textarea id="notes" className="input min-h-[90px]" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Caution fee split 50/50. Guests max 2 nights. Rent paid by the 1st." />
        <p className="mt-1 text-xs text-ink-500">{notes.length} / 500</p>
      </div>

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
        <button className="btn-primary" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save new version"}</button>
        <button className="btn-ghost" onClick={onCancel}>Cancel</button>
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
        <h2 className="font-semibold text-ink">Shortlist</h2>
        <button className="btn-secondary text-sm" onClick={() => setShowAdd((s) => !s)}>{showAdd ? "Done" : "Add a home"}</button>
      </div>

      {hh.shortlist.length === 0 && <p className="card p-6 text-center text-sm text-ink-600">No homes shortlisted yet.</p>}

      {hh.shortlist.map((item: any) => {
        const myVote = item.votes.find((v: any) => v.userId === meId)?.decision;
        const prop = item.property;
        return (
          <div key={item.id} className="card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-ink">{item.title}</p>
                {prop && <p className="text-sm text-ink-600">{CITIES[prop.cityId as keyof typeof CITIES]?.areas.find((a) => a.id === prop.areaId)?.label} · Sample availability</p>}
                {item.url && <p className="text-xs text-ink-500">Details added by a member; availability unconfirmed</p>}
              </div>
              {item.bothInterested && <span className="chip bg-brand-100 text-brand-800">Both interested</span>}
            </div>
            {prop && (
              <div className="mt-2 text-sm text-ink-600">
                <p>{formatPeriodPrice(prop.rentMinor, prop.rentPeriod, prop.currency)} · {prop.bedroomCount}-bed {prop.contractType === "room" ? "(room)" : ""}</p>
                {prop.upfrontItems?.length > 0 && (
                  <p className="mt-1 text-xs text-amber-700">Upfront: {JSON.parse(typeof prop.upfrontItems === "string" ? prop.upfrontItems : JSON.stringify(prop.upfrontItems)).map((u: any) => `${u.label} ${formatMoney(u.minor, prop.currency)}`).join(", ")}</p>
                )}
              </div>
            )}
            <div className="mt-3 flex gap-2">
              {["interested", "not_interested"].map((d) => (
                <button key={d} onClick={() => onAction(() => api(`/shortlist/${item.id}/vote`, { body: { decision: d } }))}
                  aria-pressed={myVote === d} className="choice-chip">
                  {myVote === d && <IconCheck size={14} strokeWidth={2.5} />}{d === "interested" ? "Interested" : "Not for me"}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {showAdd && (
        <div className="card p-5">
          <h3 className="font-semibold text-ink">Add from sample catalogue</h3>
          <div className="mt-3 space-y-2">
            {catalogue.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-ink-100 p-3">
                <div>
                  <p className="text-sm font-medium text-ink">{p.title}</p>
                  <p className="text-xs text-ink-600">{formatPeriodPrice(p.rentMinor, p.rentPeriod, p.currency)}</p>
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
      <h2 className="font-semibold text-ink">Viewings</h2>

      {eligible.length === 0 && hh.viewings.length === 0 && (
        <p className="card p-6 text-center text-sm text-ink-600">Both members must mark a home &quot;interested&quot; before booking a viewing.</p>
      )}

      {eligible.map((item: any) => {
        const existing = hh.viewings.find((v: any) => v.shortlistItemId === item.id && ["awaiting_partner", "confirmed", "completed", "disputed"].includes(v.state));
        return (
          <div key={item.id} className="card p-5">
            <p className="font-semibold text-ink">{item.title}</p>
            {!existing && (
              slotFor === item.id ? (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <label className="sr-only" htmlFor={`slot-${item.id}`}>Viewing date and time</label>
                  <input id={`slot-${item.id}`} type="datetime-local" className="input" value={slot} onChange={(e) => setSlot(e.target.value)} />
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
    <div className="mt-3 rounded-lg bg-cream p-3 text-sm">
      <p className="flex items-center gap-1.5 text-ink-700"><IconCalendar size={16} /> {when} <span className="text-xs text-ink-600">({tz})</span></p>
      <p className="mt-1"><span className="chip bg-white text-ink-600">{v.state.replace("_", " ")}</span></p>
      {v.state === "awaiting_partner" && v.proposedBy !== meId && (
        <button className="btn-confirm mt-2 text-sm" onClick={() => onAction(() => api(`/viewings/${v.id}`, { body: { action: "accept", expected_version: v.version } }), "Viewing confirmed")}>Confirm this time</button>
      )}
      {v.state === "awaiting_partner" && v.proposedBy === meId && <p className="mt-2 text-xs text-ink-600">Waiting for your partner to confirm.</p>}
      {v.state === "confirmed" && !myOutcome && (
        <div className="mt-2 flex gap-2">
          <button className="btn-secondary text-sm" onClick={() => onAction(() => api(`/viewings/${v.id}`, { body: { action: "outcome", response: "completed", expected_version: v.version } }), "Outcome recorded")}>I attended</button>
          <button className="btn-ghost text-sm" onClick={() => onAction(() => api(`/viewings/${v.id}`, { body: { action: "outcome", response: "no_show", expected_version: v.version } }))}>Couldn&apos;t make it</button>
        </div>
      )}
      {myOutcome && v.state === "confirmed" && <p className="mt-2 text-xs text-ink-600">You reported the outcome. Waiting for your partner.</p>}
      {v.state === "completed" && <p className="mt-2 text-sm font-medium text-brand-700">✓ Viewing completed by both.</p>}
      {v.state === "disputed" && <p className="mt-2 text-sm text-caution-800">Outcomes differ — resolve together before applying.</p>}
    </div>
  );
}

function ApplicationTab({ hh, meId, onAction }: { hh: any; meId: string; onAction: any }) {
  const handoff = hh.handoff;
  const hasCompletedViewing = hh.viewings.some((v: any) => v.state === "completed");

  if (!handoff || ["withdrawn", "rejected"].includes(handoff.state)) {
    return (
      <div className="card p-6">
        <h2 className="font-semibold text-ink">Rental handoff</h2>
        <p className="mt-2 text-sm text-ink-600">Start a demo application to the sample letting partner. You&apos;ll each consent to share your details. No home is reserved and there&apos;s no payment.</p>
        {!hasCompletedViewing && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">Tip: complete a viewing first, or acknowledge remote review to proceed.</p>}
        <button className="btn-primary mt-4" onClick={() => onAction(() => api(`/households/${hh.id}/handoffs`, { body: { remote_review_ack: true } }), "Application started")}>Start application</button>
      </div>
    );
  }

  const iConsented = handoff.acceptedBy.includes(meId);
  return (
    <div className="card p-6">
      <h2 className="font-semibold text-ink">Rental handoff</h2>
      <p className="mt-1 text-sm text-ink-600">Partner: {handoff.partnerId}</p>
      {handoff.state === "accepted" ? (
        <div className="mt-3 rounded-lg bg-brand-50 p-4 text-sm text-brand-800">
          ✓ Demo application accepted; no home is reserved. Head to Move-in to confirm.
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm text-ink-600">You&apos;ll share: display name, test contact, agreed dates, agreed contribution and verified check results — never your full evidence files or chat.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            {hh.members.map((m: any) => (
              <span key={m.userId} className={`chip ${handoff.acceptedBy.includes(m.userId) ? "bg-brand-100 text-brand-800" : "bg-ink-50 text-ink-600"}`}>
                {m.name}: {handoff.acceptedBy.includes(m.userId) ? "consented" : "pending"}
              </span>
            ))}
          </div>
          {iConsented ? (
            <p className="mt-3 rounded-lg bg-cream p-3 text-sm text-ink-600">You consented. Waiting for your partner to consent so the application can submit.</p>
          ) : (
            <button className="btn-confirm mt-4" onClick={() => onAction(() => api(`/handoffs/${handoff.id}`, { body: { action: "consent", expected_version: handoff.version } }), "Consent recorded")}>Consent &amp; share my details</button>
          )}
          <button className="btn-ghost mt-2 text-sm text-danger-600 hover:bg-danger-50" onClick={() => onAction(() => api(`/handoffs/${handoff.id}`, { body: { action: "withdraw", expected_version: handoff.version } }))}>Withdraw application</button>
        </>
      )}
    </div>
  );
}

function MoveInTab({ hh, meId, onAction }: { hh: any; meId: string; onAction: any }) {
  const [date, setDate] = useState(hh.currentPlan?.earliestDate ?? "");
  const accepted = hh.handoff?.state === "accepted";
  const mine = hh.moveIns.find((m: any) => m.userId === meId);

  if (!accepted) return <div className="card p-6 text-sm text-ink-600">Complete an accepted rental handoff first.</div>;

  return (
    <div className="card p-6">
      <h2 className="font-semibold text-ink">Confirm move-in</h2>
      <p className="mt-1 text-sm text-ink-600">The household completes only after both members confirm. Elapsed time never confirms it for you.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        {hh.members.map((m: any) => {
          const c = hh.moveIns.find((x: any) => x.userId === m.userId);
          return <span key={m.userId} className={`chip ${c?.response === "moved_in" ? "bg-brand-100 text-brand-800" : "bg-ink-50 text-ink-600"}`}>{m.name}: {c?.response ?? "pending"}</span>;
        })}
      </div>
      {mine?.response === "moved_in" ? (
        <p className="mt-3 rounded-lg bg-cream p-3 text-sm text-ink-600">You confirmed your move-in. Waiting for your partner.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="movein-date">Move-in date</label>
          <input id="movein-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          <button className="btn-confirm" disabled={!date} onClick={() => onAction(() => api(`/households/${hh.id}/move-in`, { body: { actual_date: date, response: "moved_in" } }), "Move-in confirmed")}>I&apos;ve moved in</button>
        </div>
      )}
    </div>
  );
}
