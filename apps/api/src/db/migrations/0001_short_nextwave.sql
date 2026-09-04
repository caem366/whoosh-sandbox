CREATE TYPE "public"."settlement_status" AS ENUM('pending', 'processing', 'settled', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."transaction_split_method" AS ENUM('equal', 'custom');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('posted', 'failed', 'partially_refunded', 'refunded');--> statement-breakpoint
CREATE TABLE "allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"responsible_member_id" uuid NOT NULL,
	"amount_cents" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"transaction_id" uuid NOT NULL,
	"debtor_member_id" uuid NOT NULL,
	"creditor_member_id" uuid NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" varchar(3) DEFAULT 'CAD' NOT NULL,
	"status" "settlement_status" DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"payer_member_id" uuid NOT NULL,
	"merchant" varchar(160) NOT NULL,
	"total_cents" bigint NOT NULL,
	"currency" varchar(3) DEFAULT 'CAD' NOT NULL,
	"split_method" "transaction_split_method" NOT NULL,
	"status" "transaction_status" DEFAULT 'posted' NOT NULL,
	"idempotency_key" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_responsible_member_id_group_members_id_fk" FOREIGN KEY ("responsible_member_id") REFERENCES "public"."group_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_debtor_member_id_group_members_id_fk" FOREIGN KEY ("debtor_member_id") REFERENCES "public"."group_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_creditor_member_id_group_members_id_fk" FOREIGN KEY ("creditor_member_id") REFERENCES "public"."group_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_payer_member_id_group_members_id_fk" FOREIGN KEY ("payer_member_id") REFERENCES "public"."group_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "allocations_transaction_id_index" ON "allocations" USING btree ("transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "allocations_transaction_member_unique" ON "allocations" USING btree ("transaction_id","responsible_member_id");--> statement-breakpoint
CREATE INDEX "settlements_group_status_index" ON "settlements" USING btree ("group_id","status");--> statement-breakpoint
CREATE INDEX "settlements_debtor_status_index" ON "settlements" USING btree ("debtor_member_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "settlements_transaction_debtor_creditor_unique" ON "settlements" USING btree ("transaction_id","debtor_member_id","creditor_member_id");--> statement-breakpoint
CREATE INDEX "transactions_group_created_at_index" ON "transactions" USING btree ("group_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_idempotency_key_unique" ON "transactions" USING btree ("idempotency_key");