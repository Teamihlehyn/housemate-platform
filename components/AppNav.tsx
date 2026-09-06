"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";

const NAV = [
  { href: "/discover", label: "Discover", icon: "🔍" },
  { href: "/messages", label: "Messages", icon: "💬" },
  { href: "/household", label: "Household", icon: "🏠" },
  { href: "/profile", label: "Profile", icon: "👤" },
];

export default function AppNav({
  displayName,
  initials,
  isStaff,
}: {
  displayName: string;
  initials: string;
  isStaff: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;
    const load = () =>
      api<{ unread: number }>("/notifications")
        .then((d) => active && setUnread(d.unread))
        .catch(() => {});
    load();
    const t = setInterval(load, 10000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [pathname]);

  async function logout() {
    await api("/auth/logout", { body: {} });
    router.push("/");
    router.refresh();
  }

  const active = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* Top bar */}
      <header className="sticky top-8 z-40 border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/discover" className="flex items-center gap-2 font-bold text-brand-700">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">H</span>
            <span className="hidden sm:inline">Housemate</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  active(n.href) ? "bg-brand-50 text-brand-700" : "text-stone-600 hover:bg-stone-100"
                }`}
              >
                {n.label}
              </Link>
            ))}
            {isStaff && (
              <Link
                href="/staff"
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  active("/staff") ? "bg-brand-50 text-brand-700" : "text-stone-600 hover:bg-stone-100"
                }`}
              >
                Staff
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/notifications" className="relative rounded-lg p-2 hover:bg-stone-100" aria-label="Notifications">
              <span className="text-lg">🔔</span>
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-[20px] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unread}
                </span>
              )}
            </Link>
            <div className="hidden items-center gap-2 sm:flex">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                {initials}
              </span>
              <span className="text-sm font-medium text-stone-700">{displayName}</span>
            </div>
            <button onClick={logout} className="btn-ghost px-2 py-1 text-sm">Sign out</button>
          </div>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-stone-200 bg-white md:hidden">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`flex flex-col items-center gap-0.5 py-2 text-xs font-medium ${
              active(n.href) ? "text-brand-700" : "text-stone-500"
            }`}
          >
            <span className="text-lg">{n.icon}</span>
            {n.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
