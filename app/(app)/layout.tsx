import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { isStaffRole } from "@/lib/guard";
import AppNav from "@/components/AppNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  // Applicants have no member pages (ENG-39): back to their application.
  if (user.accountStatus === "applicant" || user.sessionScope !== "member") {
    const app = await prisma.application.findUnique({ where: { userId: user.id }, select: { status: true } });
    redirect(app?.status === "draft" ? "/join" : "/join/status");
  }
  // Staff accounts are back-office only (founder, 10 Nov): no product pages.
  if (isStaffRole(user.role)) redirect("/staff");

  const initials =
    user.profile?.avatarInitials ??
    user.displayName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen pb-[calc(env(safe-area-inset-bottom)+80px)] md:pb-20 has-[[data-no-bottom-nav]]:pb-0">
      <AppNav displayName={user.displayName} initials={initials} />
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
