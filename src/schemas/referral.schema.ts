import { z } from "zod";

export const createReferralSchema = z.object({
  referralCode: z.string().trim().min(1).max(30),
  referredUserId: z.string().min(1),
  referredType: z.enum(["CITIZEN", "HEALTH_PARTNER"]),
});
