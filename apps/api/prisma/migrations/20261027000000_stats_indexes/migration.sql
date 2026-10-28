-- CreateIndex
CREATE INDEX "attempts_organization_id_status_graded_at_idx" ON "attempts"("organization_id", "status", "graded_at");

-- CreateIndex
CREATE INDEX "attempts_organization_id_status_finished_at_idx" ON "attempts"("organization_id", "status", "finished_at");

-- CreateIndex
CREATE INDEX "progress_events_organization_id_type_occurred_at_idx" ON "progress_events"("organization_id", "type", "occurred_at");
