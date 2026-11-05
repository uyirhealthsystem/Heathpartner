import { Request, Response } from "express";
import { getMyReferrals } from "../services/referral.service";

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
