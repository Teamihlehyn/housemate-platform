import { prisma } from "./db";
import { writeAudit } from "./audit";
import { emailConfigured, sendEmail } from "./email";
import { siteUrl } from "./env";
import { maskEmail } from "./invites";
import { lockKey } from "./rateLimit";
import { adminEmails } from "./staff";
import { staffAlertEmail } from "./emails";

// Back-office security alerts (ENG-48, HM-44 option A). Every admin, and the staff member
// concerned, is told when a back-office password is set and when someone signs in to the back
// office, so a hijacked inbox can't be used quietly. Sent after the response; a failure is
// logged and audited and never blocks the sign-in. No token, code or IP is ever included.

export type AlertKind = "password_set" | "signin";
export const SIGNIN_ALERT_GAP_MS = 10 * 60 * 1000; // at most one sign-in alert per address per 10 minutes

// "Thu 12 Nov, 14:05 London · 14:05 Lagos" style, in both pilot time zones.
export function alertTime(at: Date): string {
  const f = (tz: string) =>
    new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: tz }).format(at);
  return `${f("Europe/London")} (London) · ${f("Africa/Lagos")} (Lagos)`;
}

// A coarse device hint from the User-Agent: browser family and OS family only, no versions.
export function deviceHint(ua: string | null | undefined): string {
  const s = ua || "";
  const browser = /Edg\//.test(s) ? "Edge"
    : /OPR\/|Opera/.test(s) ? "Opera"
    : /SamsungBrowser/.test(s) ? "Samsung Internet"
    : /Firefox\/|FxiOS/.test(s) ? "Firefox"
    : /Chrome\/|CriOS/.test(s) ? "Chrome"
    : /Safari\//.test(s) ? "Safari"
    : "an unknown browser";
  const os = /iPhone|iPad|iPod/.test(s) ? "iOS"
    : /Android/.test(s) ? "Android"
    : /CrOS/.test(s) ? "ChromeOS"
    : /Windows/.test(s) ? "Windows"
    : /Mac OS X|Macintosh/.test(s) ? "macOS"
    : /Linux/.test(s) ? "Linux"
    : "an unknown system";
  return `${browser} on ${os}`;
}

// Who gets the alert: every admin, plus the staff address itself.
export function alertRecipients(staffEmail: string, admins: string[] = adminEmails()): string[] {
  return [...new Set([...admins, staffEmail.trim().toLowerCase()])];
}

export async function sendStaffAlert(
  kind: AlertKind,
  staff: { id: string; email: string },
  opts: { rid: string; at?: Date; userAgent?: string | null }
): Promise<void> {
  try {
    const at = opts.at ?? new Date();
    if (kind === "signin") {
      // One sign-in alert per address per 10 minutes; checked and recorded under a lock.
      const go = await prisma.$transaction(async (tx) => {
        await lockKey(tx, `staff-alert:${staff.id}`);
        const recent = await tx.auditEvent.count({
          where: { eventType: "staff.alert_window", subjectId: staff.id, occurredAt: { gt: new Date(Date.now() - SIGNIN_ALERT_GAP_MS) } },
        });
        if (recent > 0) return false;
        await writeAudit(tx, { eventType: "staff.alert_window", actorType: "service", subjectId: staff.id, resourceType: "user", resourceId: staff.id, action: "signin" }, opts.rid);
        return true;
      });
      if (!go) return;
    }
    const msg = staffAlertEmail({
      kind,
      masked: maskEmail(staff.email),
      time: alertTime(at),
      device: kind === "signin" ? deviceHint(opts.userAgent) : null,
      signin_url: `${siteUrl()}/staff/signin`,
    });
    for (const to of alertRecipients(staff.email)) {
      let status = "sent";
      if (!emailConfigured()) status = "not_configured";
      else {
        try {
          await sendEmail({ to, ...msg, what: "the alert" });
        } catch {
          status = "failed";
        }
      }
      if (status !== "sent") console.error("Back-office security alert not delivered", kind, status);
      await prisma.$transaction((tx) =>
        writeAudit(tx, {
          eventType: status === "sent" ? "staff.alert_sent" : "staff.alert_failed",
          actorType: "service",
          subjectId: staff.id,
          resourceType: "email",
          resourceId: kind,
          action: "send",
          outcome: status === "sent" ? "allowed" : "failed",
          reasonCode: status,
        }, opts.rid)
      );
    }
  } catch (e) {
    console.error("Back-office security alert crashed", (e as Error)?.message ?? "unknown");
  }
}
