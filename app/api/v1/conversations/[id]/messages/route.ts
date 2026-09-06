import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { writeAudit, writeOutbox, notify } from "@/lib/audit";

function escapeBody(raw: string): string {
  // Server strips unsafe markup; render escapes on the client too.
  return raw.replace(/[<>]/g, (c) => (c === "<" ? "&lt;" : "&gt;")).slice(0, 2000);
}

async function loadConvo(id: string, userId: string) {
  const convo = await prisma.conversation.findUnique({ where: { id } });
  if (!convo || (convo.userAId !== userId && convo.userBId !== userId)) return null;
  return convo;
}

// GET messages after a sequence (reconnect fetches everything after last acked).
export const GET = handler(async (req: NextRequest, { rid, params }) => {
  const user = await requireUser();
  const convo = await loadConvo(params.id, user.id);
  if (!convo) return fail("NOT_FOUND", "Conversation not found.", 404, rid);
  const after = Number(new URL(req.url).searchParams.get("after_sequence") ?? 0);
  const messages = await prisma.message.findMany({
    where: { conversationId: convo.id, serverSequence: { gt: after } },
    orderBy: { serverSequence: "asc" },
  });
  const otherId = convo.userAId === user.id ? convo.userBId : convo.userAId;
  const other = await prisma.user.findUnique({ where: { id: otherId }, include: { profile: true } });
  return ok(
    {
      status: convo.status,
      introductionId: convo.introductionId,
      otherUserId: otherId,
      otherName: other?.displayName ?? "Member",
      otherInitials: other?.profile?.avatarInitials ?? "?",
      messages: messages.map((m) => ({
        id: m.id,
        senderId: m.senderId,
        clientMessageId: m.clientMessageId,
        sequence: m.serverSequence,
        body: m.body,
        sentAt: m.sentAt,
        mine: m.senderId === user.id,
      })),
    },
    rid
  );
});

// POST a message {client_message_id, body}. Dedup by (sender, client_message_id).
export const POST = handler(async (req: NextRequest, { rid, params }) => {
  const user = await requireUser();
  const convo = await loadConvo(params.id, user.id);
  if (!convo) return fail("NOT_FOUND", "Conversation not found.", 404, rid);
  if (convo.status === "closed")
    return fail("STATE_CONFLICT", "This conversation is closed.", 409, rid);

  const body = await req.json().catch(() => ({}));
  const clientMessageId = String(body.client_message_id ?? "").trim();
  const text = String(body.body ?? "").trim();
  if (!clientMessageId) return fail("VALIDATION", "client_message_id required.", 422, rid);
  if (!text || text.length > 2000)
    return fail("VALIDATION", "Message must be 1–2000 characters.", 422, rid);

  // Dedup: same sender + client_message_id returns the original message.
  const existing = await prisma.message.findUnique({
    where: { senderId_clientMessageId: { senderId: user.id, clientMessageId } },
  });
  if (existing) {
    return ok(
      { id: existing.id, sequence: existing.serverSequence, sentAt: existing.sentAt, deduped: true },
      rid
    );
  }

  const otherId = convo.userAId === user.id ? convo.userBId : convo.userAId;

  // Suspicious money-request wording → non-blocking caution flag (seeded rule).
  const caution = /\b(send|transfer|deposit|pay).{0,20}(money|cash|£|₦|\$|account|bank)/i.test(text);

  const result = await prisma.$transaction(async (tx) => {
    const fresh = await tx.conversation.update({
      where: { id: convo.id },
      data: { lastSequence: { increment: 1 } },
    });
    const msg = await tx.message.create({
      data: {
        conversationId: convo.id,
        senderId: user.id,
        clientMessageId,
        serverSequence: fresh.lastSequence,
        body: escapeBody(text),
      },
    });
    // Audit/analytics log metadata only — never message body text.
    await writeAudit(tx, { eventType: "message.sent", actorId: user.id, subjectId: otherId, resourceType: "message", resourceId: msg.id, action: "send" }, rid);
    await writeOutbox(tx, "message_sent", { conversationId: convo.id, sequence: msg.serverSequence });
    await notify(tx, otherId, "message_received", "New message", `${user.displayName} sent you a message.`);
    return msg;
  });

  return ok(
    { id: result.id, sequence: result.serverSequence, sentAt: result.sentAt, caution },
    rid
  );
});
