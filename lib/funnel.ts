"use client";

// Browser side of the step funnel (ENG-58). A random id per tab session (sessionStorage), never
// tied to a person by the browser. Fire-and-forget: tracking can't break or slow the flow.
import { FLOW_VERSION } from "./funnelEvents";

function funnelId(): string {
  try {
    let id = sessionStorage.getItem("pb_funnel");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("pb_funnel", id);
    }
    return id;
  } catch {
    return "no-storage-0000";
  }
}

export function trackFunnel(event: string, props: { step?: string; index?: number; msOnStep?: number; source?: string } = {}): void {
  try {
    const body = JSON.stringify({
      event,
      step: props.step,
      index: props.index,
      ms_on_step: props.msOnStep,
      source: props.source,
      flow_version: FLOW_VERSION,
      funnel_id: funnelId(),
    });
    fetch("/api/v1/funnel", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true, credentials: "same-origin" }).catch(() => {});
  } catch {
    /* never throw */
  }
}
