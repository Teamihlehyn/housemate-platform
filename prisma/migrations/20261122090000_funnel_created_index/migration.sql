-- HM-50: index for the funnel's site-wide hourly cap. Additive.
-- CreateIndex
CREATE INDEX "FunnelEvent_createdAt_idx" ON "FunnelEvent"("createdAt");

