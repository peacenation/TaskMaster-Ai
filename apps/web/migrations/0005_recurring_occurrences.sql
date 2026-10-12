ALTER TABLE "recurrence_rules" ADD COLUMN "stopped_at" timestamp with time zone;
ALTER TABLE "tasks" ADD COLUMN "recurrence_rule_id" uuid;
ALTER TABLE "tasks" ADD COLUMN "occurrence_date" date;
ALTER TABLE "tasks" ADD COLUMN "occurrence_slot" integer;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_recurrence_rule_id_recurrence_rules_id_fk" FOREIGN KEY ("recurrence_rule_id") REFERENCES "recurrence_rules"("id") ON DELETE set null ON UPDATE no action;
CREATE UNIQUE INDEX "tasks_recurrence_occurrence_unique" ON "tasks" USING btree ("recurrence_rule_id", "occurrence_date", "occurrence_slot");