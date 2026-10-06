"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiClientError } from "@/lib/client";

export default function Settings() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function exportData() {
    setBusy("export"); setMsg(null);
    try {
      const d = await api<{ export: unknown }>("/me/export");
      const blob = new Blob([JSON.stringify(d.export, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "housemate-data.json"; a.click();
      URL.revokeObjectURL(url);
      setMsg("Your data has been downloaded.");
    } catch (e) {
      setMsg(e instanceof ApiClientError ? e.message : "Export failed.");
    } finally { setBusy(null); }
  }

  async function deleteAccount() {
    if (!confirm("Delete your account? Your profile is hidden immediately and your data is removed under our retention policy. This can't be undone here.")) return;
    setBusy("delete"); setMsg(null);
    try {
      await api("/me/delete", { body: {} });
      router.push("/"); router.refresh();
    } catch (e) {
      setMsg(e instanceof ApiClientError ? e.message : "Deletion failed.");
    } finally { setBusy(null); }
  }

  async function signOut() {
    await api("/auth/logout", { body: {} });
    router.push("/"); router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold text-stone-900">Settings &amp; privacy</h1>
      {msg && <div className="mb-4 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm text-brand-800">{msg}</div>}

      <div className="card divide-y divide-stone-100">
        <Row title="Your data" desc="Download everything we hold about you as a JSON file.">
          <button className="btn-secondary" disabled={busy === "export"} onClick={exportData}>{busy === "export" ? "Preparing…" : "Export my data"}</button>
        </Row>
        <Row title="Privacy notice" desc="How we collect and use your data.">
          <Link href="/privacy" target="_blank" className="btn-secondary">View notice</Link>
        </Row>
        <Row title="Sign out" desc="Sign out of this device.">
          <button className="btn-secondary" onClick={signOut}>Sign out</button>
        </Row>
        <Row title="Delete account" desc="Hide your profile immediately and remove your data under our retention policy.">
          <button className="btn-danger" disabled={busy === "delete"} onClick={deleteAccount}>{busy === "delete" ? "Processing…" : "Delete account"}</button>
        </Row>
      </div>
    </div>
  );
}

function Row({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 p-5">
      <div>
        <p className="font-medium text-stone-900">{title}</p>
        <p className="text-sm text-stone-500">{desc}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
