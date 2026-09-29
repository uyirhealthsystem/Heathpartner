import { Request, Response } from "express";
import { createReferralSchema } from "../schemas/referral.schema";
import {
  createCitizenReferral,
  getMyReferrals,
} from "../services/referral.service";

export async function create(req: Request, res: Response) {
  try {
    const body = createReferralSchema.parse(req.body);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    if (body.referredType !== "CITIZEN") {
      return res.status(400).json({
        message:
          "Use Health Partner creation with referralCode for Health Partner referrals",
      });
    }

    const result = await createCitizenReferral(
      userId,
      body.referralCode,
      body.referredUserId
    );

    return res.status(201).json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create referral";

    return res.status(400).json({ message });
  }
}

export async function list(req: Request, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const result = await getMyReferrals(userId);

    return res.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load referrals";

    return res.status(400).json({ message });
  }
}
