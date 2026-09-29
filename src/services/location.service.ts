import { Pool, PoolClient } from "pg";
import { pool } from "../config/db";
import { DistrictHealthPartnersQuery } from "../schemas/location.schema";
import { createId } from "../utils/id";
import { healthPartnerSelect } from "./health-partner.query";

type Db = Pool | PoolClient;

function isUniqueViolation(error: unknown) {
  return (error as { code?: string })?.code === "23505";
}

// ---- Location master: District -> Block -> Village ----

export async function listDistricts() {
  const result = await pool.query(
    `
    SELECT id, name, created_at AS "createdAt"
    FROM districts
    ORDER BY name
    `
  );

  return result.rows;
}

export async function createDistrict(name: string) {
  try {
    const result = await pool.query(
      `
      INSERT INTO districts (id, name)
      VALUES ($1, $2)
      RETURNING id, name, created_at AS "createdAt"
      `,
      [createId("dist"), name]
    );

    return result.rows[0];
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Error("District already exists");
    }

    throw error;
  }
}

export async function getDistrict(districtId: string) {
  const result = await pool.query(
    `SELECT id, name FROM districts WHERE id = $1`,
    [districtId]
  );

  if (!result.rowCount) {
    throw new Error("District not found");
  }

  return result.rows[0];
}

export async function listBlocks(districtId: string) {
  await getDistrict(districtId);

  const result = await pool.query(
    `
    SELECT id, district_id AS "districtId", name, created_at AS "createdAt"
    FROM blocks
    WHERE district_id = $1
    ORDER BY name
    `,
    [districtId]
  );

  return result.rows;
}

export async function createBlock(districtId: string, name: string) {
  await getDistrict(districtId);

  try {
    const result = await pool.query(
      `
      INSERT INTO blocks (id, district_id, name)
      VALUES ($1, $2, $3)
      RETURNING id, district_id AS "districtId", name, created_at AS "createdAt"
      `,
      [createId("blk"), districtId, name]
    );

    return result.rows[0];
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Error("Block already exists in this district");
    }

    throw error;
  }
}

async function getBlockInDistrict(districtId: string, blockId: string) {
  const result = await pool.query(
    `SELECT id FROM blocks WHERE id = $1 AND district_id = $2`,
    [blockId, districtId]
  );

  if (!result.rowCount) {
    throw new Error("Block not found in this district");
  }
}

export async function listVillages(districtId: string, blockId: string) {
  await getBlockInDistrict(districtId, blockId);

  const result = await pool.query(
    `
    SELECT id, block_id AS "blockId", name, created_at AS "createdAt"
    FROM villages
    WHERE block_id = $1
    ORDER BY name
    `,
    [blockId]
  );

  return result.rows;
}

export async function createVillage(
  districtId: string,
  blockId: string,
  name: string
) {
  await getBlockInDistrict(districtId, blockId);

  try {
    const result = await pool.query(
      `
      INSERT INTO villages (id, block_id, name)
      VALUES ($1, $2, $3)
      RETURNING id, block_id AS "blockId", name, created_at AS "createdAt"
      `,
      [createId("vil"), blockId, name]
    );

    return result.rows[0];
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Error("Village already exists in this block");
    }

    throw error;
  }
}

// Checks that the block belongs to the district and the village to the block.
export async function validateLocation(
  db: Db,
  location: {
    districtId: string;
    blockId?: string | null;
    villageId?: string | null;
  }
) {
  const district = await db.query(`SELECT id FROM districts WHERE id = $1`, [
    location.districtId,
  ]);

  if (!district.rowCount) {
    throw new Error("District not found");
  }

  if (location.blockId) {
    const block = await db.query(
      `SELECT id FROM blocks WHERE id = $1 AND district_id = $2`,
      [location.blockId, location.districtId]
    );

    if (!block.rowCount) {
      throw new Error("Block not found in this district");
    }
  }

  if (location.villageId) {
    if (!location.blockId) {
      throw new Error("blockId is required when villageId is given");
    }

    const village = await db.query(
      `SELECT id FROM villages WHERE id = $1 AND block_id = $2`,
      [location.villageId, location.blockId]
    );

    if (!village.rowCount) {
      throw new Error("Village not found in this block");
    }
  }
}

// ---- District level Health Partner APIs ----

export async function getDistrictHealthPartners(
  districtId: string,
  query: DistrictHealthPartnersQuery
) {
  const district = await getDistrict(districtId);

  const conditions = ["hp.district_id = $1"];
  const values: unknown[] = [districtId];

  if (query.blockId) {
    values.push(query.blockId);
    conditions.push(`hp.block_id = $${values.length}`);
  }

  if (query.villageId) {
    values.push(query.villageId);
    conditions.push(`hp.village_id = $${values.length}`);
  }

  if (query.status) {
    values.push(query.status);
    conditions.push(`hp.status = $${values.length}`);
  }

  if (query.search) {
    values.push(`%${query.search}%`);
    conditions.push(
      `(hp.full_name ILIKE $${values.length} OR hp.phone ILIKE $${values.length})`
    );
  }

  const where = conditions.join(" AND ");

  const count = await pool.query(
    `SELECT COUNT(*)::int AS total FROM health_partners hp WHERE ${where}`,
    values
  );

  const offset = (query.page - 1) * query.limit;

  const result = await pool.query(
    `
    ${healthPartnerSelect}
    WHERE ${where}
    ORDER BY b.name NULLS LAST, v.name NULLS LAST, hp.full_name
    LIMIT $${values.length + 1}
    OFFSET $${values.length + 2}
    `,
    [...values, query.limit, offset]
  );

  const total = count.rows[0].total;

  return {
    district,
    data: result.rows,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

// Health Partner counts for a district, broken down by block and village.
// Blocks and villages with no Health Partners are included with 0.
export async function getDistrictSummary(districtId: string) {
  const district = await getDistrict(districtId);

  const totals = await pool.query(
    `
    SELECT
      COUNT(*)::int AS "total",
      COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS "active",
      COUNT(*) FILTER (WHERE status = 'INACTIVE')::int AS "inactive",
      COUNT(*) FILTER (WHERE block_id IS NULL)::int AS "withoutBlock"
    FROM health_partners
    WHERE district_id = $1
    `,
    [districtId]
  );

  const blocks = await pool.query(
    `
    SELECT
      b.id AS "blockId",
      b.name AS "blockName",
      COUNT(hp.id)::int AS "total",
      COUNT(hp.id) FILTER (WHERE hp.village_id IS NULL)::int AS "withoutVillage"
    FROM blocks b
    LEFT JOIN health_partners hp
      ON hp.block_id = b.id
    WHERE b.district_id = $1
    GROUP BY b.id, b.name
    ORDER BY b.name
    `,
    [districtId]
  );

  const villages = await pool.query(
    `
    SELECT
      v.id AS "villageId",
      v.name AS "villageName",
      v.block_id AS "blockId",
      COUNT(hp.id)::int AS "total"
    FROM villages v
    INNER JOIN blocks b
      ON b.id = v.block_id
    LEFT JOIN health_partners hp
      ON hp.village_id = v.id
    WHERE b.district_id = $1
    GROUP BY v.id, v.name, v.block_id
    ORDER BY v.name
    `,
    [districtId]
  );

  return {
    district,
    ...totals.rows[0],
    blocks: blocks.rows.map((block) => ({
      ...block,
      villages: villages.rows
        .filter((village) => village.blockId === block.blockId)
        .map(({ blockId: _blockId, ...village }) => village),
    })),
  };
}
