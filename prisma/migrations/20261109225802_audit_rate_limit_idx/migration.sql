-- CreateIndex
CREATE INDEX "AuditEvent_eventType_occurredAt_idx" ON "AuditEvent"("eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_eventType_resourceId_occurredAt_idx" ON "AuditEvent"("eventType", "resourceId", "occurredAt");
