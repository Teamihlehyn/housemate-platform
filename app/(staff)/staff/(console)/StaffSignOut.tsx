"use client";

import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

export default function StaffSignOut() {
  const router = useRouter();
  async function signOut() {
    await api("/staff/auth/logout", { body: {} }).catch(() => undefined);
    router.push("/staff/signin");
    router.refresh();
  }
  return (
    <button onClick={signOut} className="btn-ghost min-h-[44px] px-3 text-sm">
      Sign out
    </button>
  );
}
