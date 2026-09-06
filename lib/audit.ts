import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

// Transaction-scoped client type — audit + outbox commit with the business mutation.
type Tx = Prisma.TransactionClient;

export interface AuditInput {
  eventType: string;
  actorType?: "user" | "staff" | "service" | "job";
  actorId?: string | null;
  subjectId?: string | null;
  resourceType: string;
  resourceId: string;
  action: string;
  outcome?: "allowed" | "denied" | "failed";
  reasonCode?: string | null;
  safeBefore?: unknown;
  safeAfter?: unknown;
  versionBefore?: number | null;
  versionAfter?: number | null;
  correlationId?: string;
}

// Write a business/security audit row. Safe payloads only — never contacts, message
// bodies, evidence or precise addresses.
export async function writeAudit(tx: Tx, input: AuditInput, requestId?: string) {
  return tx.auditEvent.create({
    data: {
      eventType: input.eventType,
      actorType: input.actorType ?? "user",
      actorId: input.actorId ?? null,
      subjectId: input.subjectId ?? null,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      action: input.action,
      outcome: input.outcome ?? "allowed",
      reasonCode: input.reasonCode ?? null,
      safeBefore: input.safeBefore ? JSON.stringify(input.safeBefore) : null,
      safeAfter: input.safeAfter ? JSON.stringify(input.safeAfter) : null,
      versionBefore: input.versionBefore ?? null,
      versionAfter: input.versionAfter ?? null,
      requestId: requestId ?? null,
      correlationId: input.correlationId ?? requestId ?? randomUUID(),
    },
  });
}

// Enqueue an event for at-least-once delivery via the outbox.
export async function writeOutbox(
  tx: Tx,
  eventName: string,
  payload: unknown,
  correlationId?: string
) {
  return tx.outboxEvent.create({
    data: {
      eventName,
      payload: JSON.stringify(payload ?? {}),
      correlationId: correlationId ?? null,
    },
  });
}

// Create an in-app notification. Payload never includes messages, addresses or evidence.
export async function notify(
  tx: Tx,
  recipientId: string,
  eventName: string,
  title: string,
  body: string
) {
  return tx.notification.create({
    data: { recipientId, eventName, title, body },
  });
}
