// Automatic responses from sample housemates (users with isDemoBot) so a solo
// tester can complete every research task: intro → chat → household agreement →
// shortlist → viewing → application → move-in. Each hook is a no-op unless the
// counterpart is a sample housemate, so it is safe to call in every environment.

import { createHash } from "crypto";
import { prisma } from "./db";
import { writeAudit, writeOutbox, notify } from "./audit";
import { acceptPlan, planStatus, recordHandoffConsent, recordMoveIn, recordViewingOutcome } from "./household";

const DISCLOSURE = "(I'm a sample housemate in this prototype, so my replies are automatic.)";

const REPLIES_BEFORE_HOUSEHOLD = [
  "Thanks! Your dates and areas work well for me too. Want to form a household? Use \"Form household\" at the top of this chat, then we can agree the rent split and notice period.",
  "I'm tidy and like quiet weeknights. Happy to write any house rules into our agreement notes.",
  "For bills I'd prefer splitting equally, and 4 weeks' notice if either of us leaves. Does that sound fair?",
  "Sounds good to me!",
];

const REPLIES_IN_HOUSEHOLD = [
  "Great. Have a look at our agreement on the Household page — edit the rent split or notice and I'll review it.",
  "Once we're both agreed, let's shortlist a couple of homes and book a viewing.",
  "Happy with splitting bills equally and 4 weeks' notice. Anything else you want in writing, add it to the notes.",
  "Sounds good to me!",
];

async function botOf(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  return u?.isDemoBot ? u : null;
}

async function householdBot(householdId: string) {
  const members = await prisma.membership.findMany({ where: { householdId, state: "active" } });
  const users = await prisma.user.findMany({ where: { id: { in: members.map((m) => m.userId) } } });
  const bot = users.find((u) => u.isDemoBot) ?? null;
  const human = users.find((u) => !u.isDemoBot) ?? null;
  return { bot, human };
}

// Swallow errors: an automatic reply must never break the tester's own action.
async function safely(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    console.error("[demoBots]", e);
  }
}

export async function afterIntroduction(introId: string) {
  await safely(async () => {
    const intro = await prisma.introduction.findUnique({ where: { id: introId } });
    if (!intro || intro.state !== "pending") return;
    const targetId = intro.senderId === intro.lowUserId ? intro.highUserId : intro.lowUserId;
    const bot = await botOf(targetId);
    if (!bot) return;
    await prisma.$transaction(async (tx) => {
      const upd = await tx.introduction.updateMany({
        where: { id: intro.id, state: "pending" },
        data: { state: "accepted", version: intro.version + 1 },
      });
      if (upd.count === 0) return;
      const convo = await tx.conversation.create({
        data: { introductionId: intro.id, userAId: intro.lowUserId, userBId: intro.highUserId, lastSequence: 1 },
      });
      await tx.message.create({
        data: {
          conversationId: convo.id,
          senderId: bot.id,
          clientMessageId: `bot-${convo.id}-1`,
          serverSequence: 1,
          body: `Hi! Thanks for reaching out — I'm ${bot.displayName.split(" ")[0]}. ${DISCLOSURE}`,
        },
      });
      await writeAudit(tx, { eventType: "introduction.accepted", actorType: "service", actorId: bot.id, subjectId: intro.senderId, resourceType: "introduction", resourceId: intro.id, action: "accept" });
      await writeOutbox(tx, "introduction_accepted", { id: intro.id, conversationId: convo.id });
      await notify(tx, intro.senderId, "introduction_accepted", "Introduction accepted", `${bot.displayName} accepted your introduction.`);
    });
  });
}

export async function afterMessage(conversationId: string, senderId: string) {
  await safely(async () => {
    const convo = await prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!convo || convo.status !== "open") return;
    const bot = await botOf(convo.userAId === senderId ? convo.userBId : convo.userAId);
    if (!bot) return;
    const shared = await prisma.household.findFirst({
      where: {
        state: { in: ["proposed", "active", "completed"] },
        AND: [{ memberships: { some: { userId: bot.id } } }, { memberships: { some: { userId: senderId } } }],
      },
    });
    const replies = shared ? REPLIES_IN_HOUSEHOLD : REPLIES_BEFORE_HOUSEHOLD;
    await prisma.$transaction(async (tx) => {
      const sent = await tx.message.count({ where: { conversationId, senderId: bot.id } });
      const fresh = await tx.conversation.update({ where: { id: conversationId }, data: { lastSequence: { increment: 1 } } });
      await tx.message.create({
        data: {
          conversationId,
          senderId: bot.id,
          clientMessageId: `bot-${conversationId}-${fresh.lastSequence}`,
          serverSequence: fresh.lastSequence,
          body: replies[Math.max(0, sent - 1) % replies.length],
        },
      });
      await notify(tx, senderId, "message_received", "New message", `${bot.displayName} sent you a message.`);
    });
  });
}

// Accept the latest household plan (new proposal or changed agreement).
export async function afterPlanProposedOrChanged(householdId: string) {
  await safely(async () => {
    const { bot } = await householdBot(householdId);
    if (!bot) return;
    const { acceptedBy } = await planStatus(prisma, householdId);
    if (acceptedBy.includes(bot.id)) return;
    await acceptPlan({ householdId, userId: bot.id, actorType: "service" });
  });
}

export async function afterShortlistAdded(itemId: string) {
  await safely(async () => {
    const item = await prisma.shortlistItem.findUnique({ where: { id: itemId } });
    if (!item) return;
    const { bot, human } = await householdBot(item.householdId);
    if (!bot) return;
    await prisma.$transaction(async (tx) => {
      await tx.shortlistVote.upsert({
        where: { itemId_userId: { itemId, userId: bot.id } },
        create: { itemId, userId: bot.id, decision: "interested" },
        update: { decision: "interested" },
      });
      await writeAudit(tx, { eventType: "shortlist.voted", actorType: "service", actorId: bot.id, resourceType: "shortlist_item", resourceId: itemId, action: "vote", safeAfter: { decision: "interested" } });
      if (human) await notify(tx, human.id, "shortlist_added", "Your housemate likes it", `${bot.displayName} is interested in "${item.title}".`);
    });
  });
}

export async function afterViewingProposed(viewingId: string) {
  await safely(async () => {
    const v = await prisma.viewing.findUnique({ where: { id: viewingId } });
    if (!v || v.state !== "awaiting_partner") return;
    const { bot } = await householdBot(v.householdId);
    if (!bot || v.proposedBy === bot.id) return;
    await prisma.$transaction(async (tx) => {
      await tx.viewing.update({ where: { id: v.id }, data: { state: "confirmed", version: v.version + 1 } });
      await writeAudit(tx, { eventType: "viewing.confirmed", actorType: "service", actorId: bot.id, resourceType: "viewing", resourceId: v.id, action: "confirm" });
      await writeOutbox(tx, "viewing_confirmed", { viewingId: v.id });
      await notify(tx, v.proposedBy, "viewing_change", "Viewing confirmed", `${bot.displayName} confirmed the viewing time.`);
    });
  });
}

// Mirror the tester's report so the viewing resolves.
export async function afterViewingOutcome(viewingId: string, testerResponse: string) {
  await safely(async () => {
    const v = await prisma.viewing.findUnique({ where: { id: viewingId }, include: { outcomes: true } });
    if (!v) return;
    const { bot } = await householdBot(v.householdId);
    if (!bot || v.outcomes.some((o) => o.userId === bot.id)) return;
    await recordViewingOutcome({ viewingId, userId: bot.id, response: testerResponse, actorType: "service" });
  });
}

export async function afterHandoffActivity(handoffId: string) {
  await safely(async () => {
    const h = await prisma.handoff.findUnique({ where: { id: handoffId }, include: { acceptances: true } });
    if (!h || h.state !== "awaiting_member_consent") return;
    const { bot } = await householdBot(h.householdId);
    if (!bot || h.acceptances.some((a) => a.userId === bot.id)) return;
    await recordHandoffConsent({
      handoffId,
      userId: bot.id,
      payloadHash: createHash("sha256").update(`${handoffId}:${bot.id}:v${h.version}`).digest("hex"),
      actorType: "service",
    });
  });
}

export async function afterMoveIn(householdId: string, actualDate: string) {
  await safely(async () => {
    const { bot } = await householdBot(householdId);
    if (!bot) return;
    const mine = await prisma.moveInConfirmation.findUnique({ where: { householdId_userId: { householdId, userId: bot.id } } });
    if (mine?.response === "moved_in") return;
    await recordMoveIn({ householdId, userId: bot.id, actualDate, response: "moved_in", actorType: "service" });
  });
}
