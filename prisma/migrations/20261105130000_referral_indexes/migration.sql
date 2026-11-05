-- Per-HP reads (dashboard counts, "my referrals", payment history) filter by
-- the HP and sort newest first; without these they read the whole table.
CREATE INDEX "referrals_referrer_created_idx" ON "referrals"("referrer_health_partner_id", "created_at" DESC);
CREATE INDEX "transactions_health_partner_created_idx" ON "transactions"("health_partner_id", "created_at" DESC);

-- Referral codes are matched case-insensitively (citizen-referral.service.ts:
-- UPPER(referral_code) = UPPER($1)), which the plain unique index can't serve.
-- An expression index isn't expressible in schema.prisma; Prisma leaves it alone.
CREATE INDEX "health_partners_referral_code_upper_idx" ON "health_partners"(UPPER("referral_code"));
