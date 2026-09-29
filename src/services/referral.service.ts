import { pool } from "../config/db";
import { createId } from "../utils/id";

export async function createCitizenReferral(
  userId: string,
  referralCode: string,
  referredUserId: string
) {
  if (userId === referredUserId) {
    throw new Error("Self referral is not allowed");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const referrer = await client.query(
      `
      SELECT id
      FROM health_partners
      WHERE user_id = $1
        AND referral_code = $2
        AND status = 'ACTIVE'
      FOR UPDATE
      `,
      [userId, referralCode]
    );

    if (!referrer.rowCount) {
      throw new Error("Invalid referral code");
    }

    const existingReferral = await client.query(
      `
      SELECT id
      FROM referrals
      WHERE referred_user_id = $1
      `,
      [referredUserId]
    );

    if (existingReferral.rowCount) {
      throw new Error("This user has already been referred");
    }

    const referralId = createId("ref");
    const transactionId = createId("txn");
    const healthPartnerId = referrer.rows[0].id;

    const referral = await client.query(
      `
      INSERT INTO referrals (
        id,
        referrer_health_partner_id,
        referred_user_id,
        referral_code,
        referred_type,
        status,
        reward_amount
      )
      VALUES ($1, $2, $3, $4, 'CITIZEN', 'COMPLETED', 10)
      RETURNING
        id,
        referrer_health_partner_id AS "healthPartnerId",
        referred_user_id AS "referredUserId",
        referral_code AS "referralCode",
        referred_type AS "referredType",
        status,
        reward_amount AS "rewardAmount",
        created_at AS "createdAt"
      `,
      [
        referralId,
        healthPartnerId,
        referredUserId,
        referralCode,
      ]
    );

    await client.query(
      `
      UPDATE health_partners
      SET wallet_balance = wallet_balance + 10,
          updated_at = NOW()
      WHERE id = $1
      `,
      [healthPartnerId]
    );

    await client.query(
      `
      INSERT INTO transactions (
        id,
        health_partner_id,
        referral_id,
        type,
        amount,
        description
      )
      VALUES ($1, $2, $3, 'REFERRAL_REWARD', 10, 'Citizen referral reward')
      `,
      [transactionId, healthPartnerId, referralId]
    );

    await client.query("COMMIT");

    return referral.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

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
