import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import AppNav from "@/components/AppNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const initials =
    user.profile?.avatarInitials ??
    user.displayName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const isStaff = ["verifier", "moderator", "admin"].includes(user.role);

  return (
    <div className="min-h-screen pb-[calc(env(safe-area-inset-bottom)+80px)] md:pb-20 has-[[data-no-bottom-nav]]:pb-0">
      <AppNav displayName={user.displayName} initials={initials} isStaff={isStaff} />
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
