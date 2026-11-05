import { z } from "zod";

// Matched case-insensitively (citizen-referral.service.ts).
export const referralCodeSchema = z.string().trim().min(1).max(30);
// authservice user id of the patient (the gateway's x-user-id).
export const referredUserIdSchema = z.string().trim().min(1).max(100);

export const citizenReferralSchema = z.object({
  referralCode: referralCodeSchema,
  referredUserId: referredUserIdSchema,
});

export const cancelReferralSchema = z.object({
  referredUserId: referredUserIdSchema,
});
