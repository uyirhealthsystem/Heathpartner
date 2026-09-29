// Shared SELECT for a Health Partner with its profile and location names.
// Append a WHERE clause using the `hp`, `d`, `b`, `v` aliases.
export const healthPartnerSelect = `
  SELECT
    hp.id AS "healthPartnerId",
    hp.user_id AS "userId",
    hp.referral_code AS "referralCode",
    hp.wallet_balance AS "walletBalance",
    hp.status,
    hp.full_name AS "fullName",
    hp.phone,
    hp.email,
    TO_CHAR(hp.date_of_birth, 'YYYY-MM-DD') AS "dateOfBirth",
    hp.gender,
    hp.address_line1 AS "addressLine1",
    hp.address_line2 AS "addressLine2",
    hp.city,
    hp.state,
    hp.pincode,
    hp.profile_photo_url AS "profilePhotoUrl",
    hp.district_id AS "districtId",
    d.name AS "districtName",
    hp.block_id AS "blockId",
    b.name AS "blockName",
    hp.village_id AS "villageId",
    v.name AS "villageName",
    hp.created_at AS "createdAt",
    hp.updated_at AS "updatedAt"
  FROM health_partners hp
  LEFT JOIN districts d ON d.id = hp.district_id
  LEFT JOIN blocks b ON b.id = hp.block_id
  LEFT JOIN villages v ON v.id = hp.village_id
`;
