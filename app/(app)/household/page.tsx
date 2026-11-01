"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiClientError } from "@/lib/client";
import { formatMoney, formatPeriodPrice } from "@/lib/money";
import { formatDateRange } from "@/lib/dates";
import { CITIES } from "@/lib/constants";

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

  if (loading) return <div className="h-64 animate-pulse rounded-xl bg-stone-200" />;

  if (!hh) return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      <p className="text-3xl">🏠</p>
      <h1 className="mt-3 text-xl font-bold text-stone-900">No active household</h1>
      <p className="mt-2 text-sm text-stone-600">Once someone accepts your introduction, use &quot;Form household&quot; in your chat with them. Then you&apos;ll agree rent split, bills and notice here.</p>
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
          <span className="chip bg-amber-100 text-amber-800">Proposal</span>
          <h1 className="mt-2 text-2xl font-bold text-stone-900">Household with {other?.name} <SampleChip member={other} /></h1>
        </div>
        <AgreementCard hh={hh} meId={meId} onAction={call} onAccept={acceptPlan} />
        {!iAcceptedPlan && (
          <button className="btn-ghost mt-3 w-full text-red-600" onClick={() => confirm("Decline this household proposal? You can keep chatting.") && call(() => api(`/households/${hh.id}`, { body: { action: "leave" } }))}>Decline proposal</button>
        )}
      </div>
    );
  }

  // ---------- Completed ----------
  if (hh.state === "completed") {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="card mb-4 p-8 text-center">
          <p className="text-4xl">🎉</p>
          <h1 className="mt-3 text-xl font-bold text-stone-900">You&apos;ve moved in together!</h1>
          <p className="mt-2 text-sm text-stone-600">Both of you confirmed the move-in with {other?.name}. That completes the journey.</p>
        </div>
        <AgreementCard hh={hh} meId={meId} onAction={call} readOnly />
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
    { id: "overview", label: "Agreement" },
    { id: "properties", label: "Homes" },
    { id: "viewings", label: "Viewings" },
    { id: "application", label: "Application" },
    { id: "movein", label: "Move-in" },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Household with {other?.name} <SampleChip member={other} /></h1>
          <p className="text-sm text-stone-500">Agree how you&apos;ll live together, then find a home.</p>
        </div>
        <span className={`chip shrink-0 ${hh.derivedStage === "needs_reagreement" ? "bg-amber-100 text-amber-800" : "bg-brand-100 text-brand-800"}`}>{STAGE_LABEL[hh.derivedStage]}</span>
      </div>

      <div className="mb-4 flex items-center gap-1" aria-hidden>
        {STAGES.map((s, i) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full ${stageIdx >= 0 && i <= stageIdx ? "bg-brand-500" : "bg-stone-200"}`} />
        ))}
      </div>

      <StatusMsg msg={msg} />

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-stone-200">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${tab === t.id ? "border-brand-600 text-brand-700" : "border-transparent text-stone-500 hover:text-stone-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <AgreementCard hh={hh} meId={meId} onAction={call} onAccept={acceptPlan} />
          <div className="card mt-4 p-5 text-sm text-stone-600">
            <p className="font-medium text-stone-800">Next step</p>
            <p className="mt-1">{nextStepText(hh)}</p>
          </div>
          <button className="btn-ghost mt-3 text-sm text-red-600" onClick={() => confirm("Leaving closes the household for both of you and cancels viewings and the application. Continue?") && call(() => api(`/households/${hh.id}`, { body: { action: "leave" } }))}>Leave household</button>
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
  return <span className="chip ml-1 align-middle bg-stone-100 text-xs font-medium text-stone-500">Sample housemate · replies automatically</span>;
}

function StatusMsg({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <div className="mb-4 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm text-brand-800" role="status">{msg}</div>;
}

function AgreedGate({ hh, onOpen, children }: { hh: any; onOpen: () => void; children: React.ReactNode }) {
  if (hh.currentPlan?.agreed) return <>{children}</>;
  return (
    <div className="card p-6 text-sm text-stone-600">
      <p className="font-medium text-stone-900">Agree your plan first</p>
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
    <div className="card p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">Household agreement</h2>
          <p className="text-xs text-stone-500">Version {plan.versionNo} · written down so you both know what was agreed</p>
        </div>
        {plan.agreed ? (
          <span className="chip shrink-0 bg-brand-100 text-brand-800">✓ Agreed by both</span>
        ) : (
          <span className="chip shrink-0 bg-amber-100 text-amber-800">Waiting for {waitingFor.map((m) => (m.userId === meId ? "you" : m.name.split(" ")[0])).join(" & ")}</span>
        )}
      </div>

      <dl className="mt-5 space-y-4 text-sm">
        <div>
          <dt className="text-stone-500">Rent split (per month)</dt>
          <dd className="mt-1 space-y-1">
            {members.map((m) => {
              const c = plan.contributions[m.userId] ?? 0;
              const pct = total > 0 ? Math.round((c / total) * 100) : 0;
              return (
                <div key={m.userId} className="flex items-center justify-between gap-2">
                  <span className="text-stone-700">{m.userId === meId ? "You" : m.name}</span>
                  <span className="font-medium text-stone-900">
                    {money(c, plan.currency)}/mo <span className="font-normal text-stone-400">· {pct}%</span>
                    {plan.currency === "NGN" && <span className="block text-right text-xs font-normal text-stone-400">≈ {money(c * 12, plan.currency)}/yr</span>}
                  </span>
                </div>
              );
            })}
            <div className="flex justify-between border-t border-stone-100 pt-1 text-stone-500">
              <span>Total rent you can cover</span>
              <span>{money(total, plan.currency)}/mo</span>
            </div>
          </dd>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div><dt className="text-stone-500">Bills</dt><dd className="font-medium text-stone-900">{BILLS_LABEL[plan.billsSplit] ?? plan.billsSplit}</dd></div>
          <div><dt className="text-stone-500">Notice if someone leaves</dt><dd className="font-medium text-stone-900">{NOTICE_OPTIONS.find((n) => n.weeks === plan.noticePeriodWeeks)?.label ?? `${plan.noticePeriodWeeks} weeks`}</dd></div>
          <div><dt className="text-stone-500">Stay</dt><dd className="font-medium text-stone-900">{plan.stayMin}–{plan.stayMax} months</dd></div>
        </div>
        <div><dt className="text-stone-500">Move-in window</dt><dd className="font-medium text-stone-900">{formatDateRange(plan.earliestDate, plan.latestDate)}</dd></div>
        {plan.notes && (
          <div><dt className="text-stone-500">Also agreed</dt><dd className="whitespace-pre-wrap text-stone-800">{plan.notes}</dd></div>
        )}
      </dl>

      {!readOnly && (
        <div className="mt-5 flex flex-wrap gap-2 border-t border-stone-100 pt-4">
          {!iAccepted && onAccept && (
            <button className="btn-primary" onClick={onAccept}>{hh.state === "proposed" ? "Accept & form household" : `Accept version ${plan.versionNo}`}</button>
          )}
          <button className="btn-secondary" onClick={() => setEditing(true)}>Edit agreement</button>
        </div>
      )}
      {!readOnly && iAccepted && !plan.agreed && (
        <p className="mt-3 text-xs text-stone-500">You&apos;ve accepted this version. Changing anything creates a new version that both of you accept again.</p>
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
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-stone-900">Edit agreement</h2>
      <p className="text-sm text-stone-500">Saving creates version {plan.versionNo + 1}. Your housemate will be asked to accept it.</p>

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
                  <label className="w-28 shrink-0 text-sm text-stone-700" htmlFor={`c-${m.userId}`}>{m.name.split(" ")[0]}</label>
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">{symbol}</span>
                    <input id={`c-${m.userId}`} inputMode="decimal" className="input pl-7" value={amounts[m.userId]}
                      onChange={(e) => setAmounts((a) => ({ ...a, [m.userId]: e.target.value.replace(/[^\d.]/g, "") }))} />
                  </div>
                  <span className="w-12 text-right text-sm text-stone-400">{total > 0 && Number.isFinite(v) ? Math.round((v / total) * 100) : 0}%</span>
                </div>
                {outside && (
                  <p className="ml-[7.75rem] mt-1 text-xs text-amber-700">
                    Outside {m.name.split(" ")[0]}&apos;s saved budget ({formatMoney(band.minMonthly, plan.currency)}–{formatMoney(band.maxMonthly, plan.currency)}/mo).
                  </p>
                )}
              </div>
            );
          })}
          <p className="text-sm text-stone-500">Total: <span className="font-medium text-stone-900">{formatMoney(total, plan.currency)}/mo</span>{plan.currency === "NGN" && <> · ≈ {formatMoney(total * 12, plan.currency)}/yr</>}</p>
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
        <label className="label" htmlFor="notes">Anything else you want in writing? <span className="font-normal text-stone-400">(optional)</span></label>
        <textarea id="notes" className="input min-h-[90px]" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Caution fee split 50/50. Guests max 2 nights. Rent paid by the 1st." />
        <p className="mt-1 text-xs text-stone-400">{notes.length} / 500</p>
      </div>

      <div className="mt-5 flex gap-2">
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
