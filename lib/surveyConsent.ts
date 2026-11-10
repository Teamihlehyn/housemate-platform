import { Prisma } from "@prisma/client";
import { writeAudit } from "./audit";
import { SURVEY_OPT_IN_VERSION } from "./constants";

type Tx = Prisma.TransactionClient;
export type ConsentVia = "settings" | "onboarding" | "unsubscribe_link";

// Survey email consent (ENG-29). Opting in records when and which wording; opting out (in
// Settings or with the email link) records when. Only changes write an audit row, so a
// repeated click or a re-sent link leaves no trace. Returns whether anything changed.
export async function setSurveyOptIn(
  tx: Tx,
  userId: string,
  optIn: boolean,
  via: ConsentVia,
  rid: string
): Promise<boolean> {
  const u = await tx.user.findUnique({ where: { id: userId }, select: { surveyOptIn: true, unsubscribedAt: true } });
  if (!u) return false;
  if (optIn) {
    if (u.surveyOptIn && !u.unsubscribedAt) return false;
    await tx.user.update({
      where: { id: userId },
      data: { surveyOptIn: true, surveyOptInAt: new Date(), surveyOptInVersion: SURVEY_OPT_IN_VERSION, unsubscribedAt: null },
    });
  } else {
    if (!u.surveyOptIn) return false;
    await tx.user.update({ where: { id: userId }, data: { surveyOptIn: false, unsubscribedAt: new Date() } });
  }
  await writeAudit(tx, {
    eventType: optIn ? "consent.survey_granted" : "consent.survey_withdrawn",
    actorType: "user",
    actorId: userId,
    subjectId: userId,
    resourceType: "user",
    resourceId: userId,
    action: optIn ? "opt_in" : "opt_out",
    safeAfter: optIn ? { version: SURVEY_OPT_IN_VERSION, via } : { via },
  }, rid);
  return true;
}

export function preferencesDto(u: { surveyOptIn: boolean; surveyOptInAt: Date | null; surveyOptInVersion: string | null; unsubscribedAt: Date | null }) {
  return {
    survey_opt_in: u.surveyOptIn,
    survey_opt_in_at: u.surveyOptInAt,
    survey_opt_in_version: u.surveyOptInVersion,
    unsubscribed_at: u.unsubscribedAt,
  };
}
