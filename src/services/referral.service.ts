import { pool } from "../config/db";

// An HP's referrals, newest first. Citizen referrals are PENDING until the
// patient links their ABHA (no reward yet), then COMPLETED with the reward.
export async function getMyReferrals(userId: string) {
  const result = await pool.query(
    `
    SELECT
      r.id,
      r.referred_user_id AS "referredUserId",
      r.referred_type AS "referredType",
      r.status,
      r.reward_amount AS "rewardAmount",
      r.created_at AS "createdAt",
      r.completed_at AS "completedAt"
    FROM referrals r
    INNER JOIN health_partners hp
      ON hp.id = r.referrer_health_partner_id
    WHERE hp.user_id = $1
    ORDER BY r.created_at DESC
    `,
    [userId]
  );

  return result.rows;
}
