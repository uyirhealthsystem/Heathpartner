import { pool } from "../config/db";
import { createId } from "../utils/id";
import { createReferralCode } from "../utils/referral-code";
import { CreateHealthPartnerInput } from "../schemas/health-partner.schema";
import { getProfile } from "./profile.service";
import { validateLocation } from "./location.service";

export async function createHealthPartner(
  userId: string,
  profile: Omit<CreateHealthPartnerInput, "referralCode">,
  referralCode?: string
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await validateLocation(client, profile);

    const existingUser = await client.query(
      `SELECT id FROM health_partners WHERE user_id = $1`,
      [userId]
    );

    if (existingUser.rowCount) {
      throw new Error("Health Partner already exists for this user");
    }

    let newReferralCode = createReferralCode();

    while (true) {
      const codeCheck = await client.query(
        `SELECT id FROM health_partners WHERE referral_code = $1`,
        [newReferralCode]
      );

      if (!codeCheck.rowCount) {
        break;
      }

      newReferralCode = createReferralCode();
    }

    const healthPartnerId = createId("hp");

    await client.query(
      `
      INSERT INTO health_partners (
        id,
        user_id,
        referral_code,
        full_name,
        phone,
        email,
        date_of_birth,
        gender,
        address_line1,
        address_line2,
        city,
        state,
        pincode,
        profile_photo_url,
        district_id,
        block_id,
        village_id
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17
      )
      `,
      [
        healthPartnerId,
        userId,
        newReferralCode,
        profile.fullName,
        profile.phone,
        profile.email ?? null,
        profile.dateOfBirth ?? null,
        profile.gender ?? null,
        profile.addressLine1 ?? null,
        profile.addressLine2 ?? null,
        profile.city ?? null,
        profile.state ?? null,
        profile.pincode ?? null,
        profile.profilePhotoUrl ?? null,
        profile.districtId,
        profile.blockId ?? null,
        profile.villageId ?? null,
      ]
    );

    if (referralCode) {
      const referrer = await client.query(
        `
        SELECT id
        FROM health_partners
        WHERE referral_code = $1
          AND status = 'ACTIVE'
        FOR UPDATE
        `,
        [referralCode]
      );

      if (!referrer.rowCount) {
        throw new Error("Invalid Health Partner referral code");
      }

      const referrerId = referrer.rows[0].id;

      if (referrerId === healthPartnerId) {
        throw new Error("Self referral is not allowed");
      }

      const existingReferral = await client.query(
        `
        SELECT id
        FROM referrals
        WHERE referred_user_id = $1
        `,
        [userId]
      );

      if (existingReferral.rowCount) {
        throw new Error("This user has already been referred");
      }

      const referralId = createId("ref");
      const transactionId = createId("txn");

      await client.query(
        `
        INSERT INTO referrals (
          id,
          referrer_health_partner_id,
          referred_user_id,
          referral_code,
          referred_type,
          status,
          reward_amount,
          completed_at
        )
        VALUES ($1, $2, $3, $4, 'HEALTH_PARTNER', 'COMPLETED', 10, NOW())
        `,
        [referralId, referrerId, userId, referralCode]
      );

      await client.query(
        `
        UPDATE health_partners
        SET wallet_balance = wallet_balance + 10,
            updated_at = NOW()
        WHERE id = $1
        `,
        [referrerId]
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
        VALUES ($1, $2, $3, 'REFERRAL_REWARD', 10, 'Health Partner referral reward')
        `,
        [transactionId, referrerId, referralId]
      );
    }

    const created = await getProfile(userId, client);

    await client.query("COMMIT");

    return created;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getHealthPartnerByUserId(userId: string) {
  return getProfile(userId);
}

export async function updateHealthPartner(
  userId: string,
  data: {
    referralCode?: string;
    status?: "ACTIVE" | "INACTIVE";
  }
) {
  const current = await getHealthPartnerByUserId(userId);

  const referralCode = data.referralCode ?? current.referralCode;
  const status = data.status ?? current.status;

  await pool.query(
    `
    UPDATE health_partners
    SET referral_code = $1,
        status = $2,
        updated_at = NOW()
    WHERE user_id = $3
    `,
    [referralCode, status, userId]
  );

  return getProfile(userId);
}
