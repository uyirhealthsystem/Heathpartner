import { pool } from "./db";

async function initDatabase() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS health_partners (
        id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100) UNIQUE NOT NULL,
        referral_code VARCHAR(30) UNIQUE NOT NULL,
        wallet_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
        status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Location master: District -> Block -> Village.
    await client.query(`
      CREATE TABLE IF NOT EXISTS districts (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS districts_name_unique
        ON districts (LOWER(name));

      CREATE TABLE IF NOT EXISTS blocks (
        id VARCHAR(100) PRIMARY KEY,
        district_id VARCHAR(100) NOT NULL REFERENCES districts(id),
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS blocks_district_name_unique
        ON blocks (district_id, LOWER(name));

      CREATE TABLE IF NOT EXISTS villages (
        id VARCHAR(100) PRIMARY KEY,
        block_id VARCHAR(100) NOT NULL REFERENCES blocks(id),
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS villages_block_name_unique
        ON villages (block_id, LOWER(name));
    `);

    // Health Partner profile data is owned by this service.
    await client.query(`
      ALTER TABLE health_partners
        ADD COLUMN IF NOT EXISTS full_name VARCHAR(150),
        ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
        ADD COLUMN IF NOT EXISTS email VARCHAR(150),
        ADD COLUMN IF NOT EXISTS date_of_birth DATE,
        ADD COLUMN IF NOT EXISTS gender VARCHAR(20),
        ADD COLUMN IF NOT EXISTS address_line1 VARCHAR(255),
        ADD COLUMN IF NOT EXISTS address_line2 VARCHAR(255),
        ADD COLUMN IF NOT EXISTS city VARCHAR(100),
        ADD COLUMN IF NOT EXISTS state VARCHAR(100),
        ADD COLUMN IF NOT EXISTS pincode VARCHAR(10),
        ADD COLUMN IF NOT EXISTS profile_photo_url VARCHAR(500),
        ADD COLUMN IF NOT EXISTS district_id VARCHAR(100) REFERENCES districts(id),
        ADD COLUMN IF NOT EXISTS block_id VARCHAR(100) REFERENCES blocks(id),
        ADD COLUMN IF NOT EXISTS village_id VARCHAR(100) REFERENCES villages(id);

      CREATE INDEX IF NOT EXISTS health_partners_district_idx
        ON health_partners (district_id);
      CREATE INDEX IF NOT EXISTS health_partners_block_idx
        ON health_partners (block_id);
      CREATE INDEX IF NOT EXISTS health_partners_village_idx
        ON health_partners (village_id);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS referrals (
        id VARCHAR(100) PRIMARY KEY,
        referrer_health_partner_id VARCHAR(100) NOT NULL
          REFERENCES health_partners(id),
        referred_user_id VARCHAR(100) NOT NULL,
        referral_code VARCHAR(30) NOT NULL,
        referred_type VARCHAR(30) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'COMPLETED',
        reward_amount NUMERIC(12, 2) NOT NULL DEFAULT 10,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT referrals_type_check
          CHECK (referred_type IN ('CITIZEN', 'HEALTH_PARTNER')),
        CONSTRAINT referrals_status_check
          CHECK (status IN ('PENDING', 'COMPLETED', 'CANCELLED')),
        CONSTRAINT referrals_unique_user
          UNIQUE (referred_user_id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id VARCHAR(100) PRIMARY KEY,
        health_partner_id VARCHAR(100) NOT NULL
          REFERENCES health_partners(id),
        referral_id VARCHAR(100),
        type VARCHAR(40) NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        description VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS bank_accounts (
        id VARCHAR(100) PRIMARY KEY,
        health_partner_id VARCHAR(100) UNIQUE NOT NULL
          REFERENCES health_partners(id),
        account_holder_name VARCHAR(150) NOT NULL,
        account_number VARCHAR(50) NOT NULL,
        ifsc_code VARCHAR(20) NOT NULL,
        bank_name VARCHAR(150) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS withdrawals (
        id VARCHAR(100) PRIMARY KEY,
        health_partner_id VARCHAR(100) NOT NULL
          REFERENCES health_partners(id),
        bank_account_id VARCHAR(100) NOT NULL
          REFERENCES bank_accounts(id),
        amount NUMERIC(12, 2) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        processed_at TIMESTAMPTZ
      );
    `);

    await client.query("COMMIT");
    console.log("Health Partner database ready");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Database initialization failed:", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

initDatabase();
