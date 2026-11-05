-- Citizen referrals now start PENDING (patient signed up with the code) and
-- become COMPLETED - with the reward - only when userservice reports the
-- patient's ABHA linked. A PENDING referral has no completion time yet.
ALTER TABLE "referrals" ALTER COLUMN "completed_at" DROP NOT NULL,
ALTER COLUMN "completed_at" DROP DEFAULT;
