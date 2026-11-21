"use client";

// What's waiting for the user in Messages (DES-25 / ENG-51): unread messages plus
// introductions waiting for an answer, from GET /conversations/unread. Polled every 30 s while
// the tab is visible, and again on focus or when `key` (the path) changes. Read state is private
// to the reader: nothing here is ever shown to the sender (SEC-16).

import { useEffect, useState } from "react";
import { api } from "@/lib/client";

type Unread = { unread_messages?: number; unread_threads?: number; pending_introductions?: number };

/** Unread messages + pending introductions, or 0 if the count isn't available. */
export function useInbox(key?: string): { total: number } {
  const [total, setTotal] = useState(0);
  useEffect(() => {
    let live = true;
    const run = () => {
      if (document.visibilityState === "hidden") return;
      api<Unread>("/conversations/unread")
        .then((u) => live && setTotal((u.unread_messages ?? 0) + (u.pending_introductions ?? 0)))
        .catch(() => {});
    };
    run();
    const t = setInterval(run, 30000);
    document.addEventListener("visibilitychange", run);
    window.addEventListener("focus", run);
    return () => {
      live = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", run);
      window.removeEventListener("focus", run);
    };
  }, [key]);
  return { total };
}

/** "3 new" for screen readers and badges. */
export function newLabel(n: number) {
  return n > 99 ? "99+ new" : `${n} new`;
}
