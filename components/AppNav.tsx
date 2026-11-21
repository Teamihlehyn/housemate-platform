"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { FeedbackLink } from "@/components/ResearchTools";
import { PodMark, Wordmark } from "@/components/brand/Logo";
import { IconBell, IconChat, IconDiscover, IconHome, IconUser } from "@/components/icons";
import { newLabel, useInbox } from "@/components/inbox";

const NAV = [
  { href: "/discover", label: "Discover", Icon: IconDiscover },
  { href: "/messages", label: "Messages", Icon: IconChat },
  { href: "/household", label: "Household", Icon: IconHome },
  { href: "/profile", label: "Profile", Icon: IconUser },
];

export default function AppNav({
  displayName,
  initials,
}: {
  displayName: string;
  initials: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  // DES-25: one count for Messages (unread messages + introductions waiting for you).
  const inbox = useInbox(pathname);

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

  // Focused flows get the whole screen: onboarding, and chat threads (composer sits at the bottom).
  const hideBottomNav = pathname.startsWith("/onboarding") || /^\/messages\/[^/]+/.test(pathname);

  return (
    <>
      {/* Top bar */}
      <header className="sticky top-[var(--banner-h,33px)] z-40 border-b border-ink-100 bg-paper">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-2">
          <Link
            href="/discover"
            aria-label="Peabudy, go to Discover"
            className="flex min-h-[44px] items-center gap-2 rounded-full text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <PodMark size={32} />
            <Wordmark height={19} className="mt-[3px] hidden sm:block" />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active(n.href) ? "page" : undefined}
                className={`inline-flex min-h-[44px] items-center rounded-full px-3 text-sm font-semibold transition duration-quick lg:px-4 ${
                  active(n.href) ? "bg-ink text-cream" : "text-ink-700 hover:bg-ink-50"
                }`}
              >
                {n.label}
                {n.href === "/messages" && inbox.total > 0 && <CountBadge n={inbox.total} inline />}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <FeedbackLink className="hidden min-h-[44px] items-center rounded-full px-3 text-sm font-semibold text-ink-700 hover:bg-ink-50 sm:inline-flex">Feedback</FeedbackLink>
            {/* Phones: the chat icon is Messages, never Feedback (round 1, F1). Feedback stays in
                the floating pill and in Settings. */}
            <Link
              href="/messages"
              className="btn-icon relative md:hidden"
              aria-label={inbox.total > 0 ? `Messages, ${newLabel(inbox.total)}` : "Messages"}
            >
              <IconChat size={22} />
              {inbox.total > 0 && <CountBadge n={inbox.total} />}
            </Link>
            <Link href="/notifications" className="btn-icon relative" aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}>
              <IconBell size={22} />
              {unread > 0 && (
                <span aria-hidden="true" className="absolute right-0.5 top-0.5 grid h-5 min-w-[20px] place-items-center rounded-full bg-danger-600 px-1 text-[11px] font-bold text-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
            {/* The name is hidden on small tablets (768–1023 px), where the desktop nav needs the room. */}
            <div className="hidden items-center gap-2 pl-1 sm:flex md:hidden lg:flex">
              <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full bg-pea-100 text-xs font-bold text-ink">
                {initials}
              </span>
              <span className="max-w-[10rem] truncate text-sm font-medium text-ink-700">{displayName}</span>
            </div>
            <button onClick={logout} className="btn-ghost px-3 text-sm">Sign out</button>
          </div>
        </div>
      </header>

      {/* Mobile bottom nav */}
      {!hideBottomNav && (
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-ink-100 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          {NAV.map((n) => {
            const on = active(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={on ? "page" : undefined}
                className={`flex min-h-[60px] flex-col items-center justify-center gap-0.5 text-xs font-semibold ${on ? "text-ink" : "text-ink-600"}`}
              >
                <span className={`relative grid h-8 w-14 place-items-center rounded-full transition duration-quick ${on ? "bg-pea-100" : ""}`}>
                  <n.Icon size={22} strokeWidth={on ? 2.1 : 1.75} />
                  {n.href === "/messages" && inbox.total > 0 && <CountBadge n={inbox.total} />}
                </span>
                {n.label}
                {n.href === "/messages" && inbox.total > 0 && <span className="sr-only">, {newLabel(inbox.total)}</span>}
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}

/** A count with a text equivalent. Decorative dot colour never carries the meaning alone. */
function CountBadge({ n, inline = false }: { n: number; inline?: boolean }) {
  const text = n > 99 ? "99+" : String(n);
  if (inline)
    return (
      <span className="ml-1.5 inline-grid h-5 min-w-[20px] place-items-center rounded-full bg-danger-600 px-1 text-[11px] font-bold text-white">
        <span aria-hidden="true">{text}</span>
        <span className="sr-only">{newLabel(n)}</span>
      </span>
    );
  return (
    <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 grid h-5 min-w-[20px] place-items-center rounded-full bg-danger-600 px-1 text-[11px] font-bold text-white ring-2 ring-white">
      {text}
    </span>
  );
}
