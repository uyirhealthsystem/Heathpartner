import { PoolClient } from "pg";
import { pool } from "../config/db";
import { createId } from "../utils/id";

// Citizen (patient) referrals, driven by userservice over /internal/v1:
//
//   patient signs up with an HP's code  -> register  -> PENDING, no reward
//   patient's own ABHA linked           -> complete  -> COMPLETED, ₹10 to the HP
//   patient erases their account first -> cancel    -> CANCELLED
//
// Every call is idempotent - userservice retries until it gets an answer, so
// a repeat must never create a second referral or pay twice. A user can be
// referred once, ever (referrals.referred_user_id is unique).

export const CITIZEN_REFERRAL_REWARD = 10;

export class ReferralError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}

const invalidCode = () =>
  new ReferralError(404, "INVALID_REFERRAL_CODE", "No active Health Partner has this referral code.");
const selfReferral = () =>
  new ReferralError(400, "SELF_REFERRAL", "A Health Partner cannot refer themselves.");
const alreadyReferred = () =>
  new ReferralError(409, "ALREADY_REFERRED", "This user has already been referred.");

const referralColumns = `
  id,
  referrer_health_partner_id AS "healthPartnerId",
  referred_user_id AS "referredUserId",
  referral_code AS "referralCode",
  referred_type AS "referredType",
  status,
  reward_amount AS "rewardAmount",
  created_at AS "createdAt",
  completed_at AS "completedAt"
`;

interface ReferralRow {
  id: string;
  healthPartnerId: string;
  referredUserId: string;
  referralCode: string;
  referredType: string;
  status: "PENDING" | "COMPLETED" | "CANCELLED";
  rewardAmount: string;
  createdAt: Date;
  completedAt: Date | null;
}

async function inTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * The ACTIVE Health Partner behind `code`; refuses an unknown code and
 * self-referral. Case-insensitive: HPs may pick their own code (PATCH
 * /health-partners/me) and patients type it however they like. `code` in the
 * result is the HP's own spelling, which is what the referral stores.
 */
async function referrerFor(client: PoolClient, code: string, referredUserId: string) {
  const result = await client.query<{ id: string; userId: string; code: string }>(
    `
    SELECT id, user_id AS "userId", referral_code AS code
    FROM health_partners
    WHERE UPPER(referral_code) = UPPER($1) AND status = 'ACTIVE'
    ORDER BY (referral_code = $1) DESC
    LIMIT 1
    `,
    [code]
  );
  const referrer = result.rows[0];
  if (!referrer) throw invalidCode();
  if (referrer.userId === referredUserId) throw selfReferral();
  return referrer;
}

/** The user's referral, locked for the rest of the transaction. */
async function lockedReferral(client: PoolClient, referredUserId: string) {
  const result = await client.query<ReferralRow>(
    `SELECT ${referralColumns} FROM referrals WHERE referred_user_id = $1 FOR UPDATE`,
    [referredUserId]
  );
  return result.rows[0];
}

/** Ours to act on: a citizen referral made with this code. */
function sameCitizenReferral(referral: ReferralRow, code: string) {
  return referral.referredType === "CITIZEN" && referral.referralCode.toUpperCase() === code.toUpperCase();
}

async function insertReferral(
  client: PoolClient,
  healthPartnerId: string,
  referredUserId: string,
  code: string,
  status: "PENDING" | "COMPLETED"
) {
  const result = await client.query<ReferralRow>(
    `
    INSERT INTO referrals (
      id, referrer_health_partner_id, referred_user_id, referral_code,
      referred_type, status, reward_amount, completed_at
    )
    VALUES ($1, $2, $3, $4, 'CITIZEN', $5, $6, CASE WHEN $7::boolean THEN NOW() END)
    RETURNING ${referralColumns}
    `,
    [createId("ref"), healthPartnerId, referredUserId, code, status, CITIZEN_REFERRAL_REWARD, status === "COMPLETED"]
  );
  return result.rows[0];
}

async function creditReward(client: PoolClient, referral: ReferralRow) {
  await client.query(
    `UPDATE health_partners SET wallet_balance = wallet_balance + $1, updated_at = NOW() WHERE id = $2`,
    [referral.rewardAmount, referral.healthPartnerId]
  );
  await client.query(
    `
    INSERT INTO transactions (id, health_partner_id, referral_id, type, amount, description)
    VALUES ($1, $2, $3, 'REFERRAL_REWARD', $4, 'Citizen referral reward (ABHA linked)')
    `,
    [createId("txn"), referral.healthPartnerId, referral.id, referral.rewardAmount]
  );
}

// Two first calls for the same user at once: the loser hits the unique
// constraint. Running it again then finds the winner's row.
async function retryOnUniqueViolation<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return fn();
    throw error;
  }
}

/** Whether `code` would be accepted for this user (signup form check). */
export async function checkReferralCode(code: string, referredUserId: string) {
  const client = await pool.connect();
  try {
    const referrer = await referrerFor(client, code, referredUserId);
    return { valid: true, healthPartnerId: referrer.id };
  } finally {
    client.release();
  }
}

/** Patient signed up with `code`: a PENDING referral, no reward yet. */
export function registerReferral(code: string, referredUserId: string) {
  return retryOnUniqueViolation(() =>
    inTransaction(async (client) => {
      const existing = await lockedReferral(client, referredUserId);
      if (existing) {
        if (!sameCitizenReferral(existing, code)) throw alreadyReferred();
        return { referral: existing, created: false };
      }
      const referrer = await referrerFor(client, code, referredUserId);
      return { referral: await insertReferral(client, referrer.id, referredUserId, referrer.code, "PENDING"), created: true };
    })
  );
}

/**
 * Patient linked their own ABHA: COMPLETED and the reward credited, in one
 * transaction. Also works without a prior register (userservice could not
 * reach us at signup). Already COMPLETED = nothing more to do.
 */
export function completeReferral(code: string, referredUserId: string) {
  return retryOnUniqueViolation(() =>
    inTransaction(async (client) => {
      let referral = await lockedReferral(client, referredUserId);
      if (referral) {
        if (!sameCitizenReferral(referral, code)) throw alreadyReferred();
        if (referral.status === "COMPLETED") return { referral, credited: false };
        if (referral.status === "CANCELLED") {
          throw new ReferralError(409, "REFERRAL_CANCELLED", "This referral was cancelled.");
        }
        const updated = await client.query<ReferralRow>(
          `UPDATE referrals SET status = 'COMPLETED', completed_at = NOW() WHERE id = $1 RETURNING ${referralColumns}`,
          [referral.id]
        );
        referral = updated.rows[0];
      } else {
        const referrer = await referrerFor(client, code, referredUserId);
        referral = await insertReferral(client, referrer.id, referredUserId, referrer.code, "COMPLETED");
      }
      await creditReward(client, referral);
      return { referral, credited: true };
    })
  );
}

/** Patient left before linking an ABHA: PENDING -> CANCELLED. Anything else is left as it is. */
export function cancelReferral(referredUserId: string) {
  return inTransaction(async (client) => {
    const referral = await lockedReferral(client, referredUserId);
    if (!referral) return { status: null };
    if (referral.referredType !== "CITIZEN" || referral.status !== "PENDING") return { status: referral.status };
    await client.query(`UPDATE referrals SET status = 'CANCELLED' WHERE id = $1`, [referral.id]);
    return { status: "CANCELLED" as const };
  });
}
