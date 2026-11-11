import { redirect } from "next/navigation";
import { getStaffUser } from "@/lib/staffAuth";
import { PodMark, Wordmark } from "@/components/brand/Logo";
import StaffSignOut from "./StaffSignOut";

// The back office (founder, 10 Nov): its own shell, nothing from the product. No member
// navigation, no notifications, no bottom nav, no Feedback pill. Only a staff session from the
// back-office sign-in counts (ENG-47: password + emailed code, on an allowlisted address);
// anyone else, users with a user session included, is sent to /staff/signin.
export const metadata = { title: "Back office — Peabudy", robots: { index: false, follow: false } };

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await getStaffUser();
  if (!user) redirect("/staff/signin");

  return (
    <div className="min-h-screen bg-paper" data-back-office="true">
      <header className="sticky top-[var(--banner-h,0px)] z-40 border-b border-ink-100 bg-paper">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2">
          <div className="flex min-h-[44px] items-center gap-2 text-ink">
            <PodMark size={28} />
            <Wordmark height={17} className="mt-[3px] hidden sm:block" />
            <span className="ml-1 rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-cream">Back office</span>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <span className="max-w-[45vw] truncate text-sm text-ink-600" data-clarity-mask="true" title={user.email}>
              {user.email}
            </span>
            <StaffSignOut />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5">{children}</main>
    </div>
  );
}
