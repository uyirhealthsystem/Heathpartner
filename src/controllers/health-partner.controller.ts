import { Request, Response } from "express";
import {
  createHealthPartnerSchema,
  updateHealthPartnerSchema,
} from "../schemas/health-partner.schema";
import {
  createHealthPartner,
  getHealthPartnerByUserId,
  updateHealthPartner,
} from "../services/health-partner.service";
import { pool } from "../config/db";

export async function create(req: Request, res: Response) {
  try {
    const body = createHealthPartnerSchema.parse(req.body);

    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const { referralCode, ...profile } = body;

    const result = await createHealthPartner(userId, profile, referralCode);

    return res.status(201).json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create Health Partner";

    return res.status(400).json({ message });
  }
}

export async function dashboard(req: Request, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const hp = await getHealthPartnerByUserId(userId);

    const referrals = await pool.query(
      `
      SELECT
        COUNT(*)::int AS "totalReferrals",
        COALESCE(SUM(reward_amount), 0) AS "totalEarnings"
      FROM referrals
      WHERE referrer_health_partner_id = $1
        AND status = 'COMPLETED'
      `,
      [hp.healthPartnerId]
    );

    return res.json({
      healthPartnerId: hp.healthPartnerId,
      fullName: hp.fullName,
      referralCode: hp.referralCode,
      totalReferrals: referrals.rows[0].totalReferrals,
      totalEarnings: referrals.rows[0].totalEarnings,
      walletBalance: hp.walletBalance,
      status: hp.status,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load dashboard";

    return res.status(400).json({ message });
  }
}

export async function update(req: Request, res: Response) {
  try {
    const body = updateHealthPartnerSchema.parse(req.body);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const result = await updateHealthPartner(userId, body);

    return res.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update Health Partner";

    return res.status(400).json({ message });
  }
}
