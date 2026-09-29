import { Pool, PoolClient } from "pg";
import { pool } from "../config/db";
import {
  ProfileFields,
  UpdateProfileInput,
} from "../schemas/health-partner.schema";
import { healthPartnerSelect } from "./health-partner.query";
import { validateLocation } from "./location.service";

export const profileColumnMap: Record<keyof ProfileFields, string> = {
  fullName: "full_name",
  phone: "phone",
  email: "email",
  dateOfBirth: "date_of_birth",
  gender: "gender",
  addressLine1: "address_line1",
  addressLine2: "address_line2",
  city: "city",
  state: "state",
  pincode: "pincode",
  profilePhotoUrl: "profile_photo_url",
};

export async function getProfile(userId: string, db: Pool | PoolClient = pool) {
  const result = await db.query(
    `
    ${healthPartnerSelect}
    WHERE hp.user_id = $1
    `,
    [userId]
  );

  if (!result.rowCount) {
    throw new Error("Health Partner not found");
  }

  return result.rows[0];
}

export async function updateProfile(userId: string, data: UpdateProfileInput) {
  const columns: string[] = [];
  const values: unknown[] = [];

  for (const key of Object.keys(profileColumnMap) as (keyof ProfileFields)[]) {
    if (data[key] !== undefined) {
      columns.push(profileColumnMap[key]);
      values.push(data[key]);
    }
  }

  // Location is replaced as a group: District -> Block -> Village.
  if (data.districtId !== undefined) {
    const location = {
      districtId: data.districtId,
      blockId: data.blockId ?? null,
      villageId: data.villageId ?? null,
    };

    await validateLocation(pool, location);

    columns.push("district_id", "block_id", "village_id");
    values.push(location.districtId, location.blockId, location.villageId);
  }

  if (!columns.length) {
    return getProfile(userId);
  }

  const setClause = columns
    .map((column, index) => `${column} = $${index + 1}`)
    .join(", ");

  const result = await pool.query(
    `
    UPDATE health_partners
    SET ${setClause},
        updated_at = NOW()
    WHERE user_id = $${columns.length + 1}
    `,
    [...values, userId]
  );

  if (!result.rowCount) {
    throw new Error("Health Partner not found");
  }

  return getProfile(userId);
}
