import { pool } from "../config/db";
import { createId } from "../utils/id";

export async function getPaymentSummary(userId: string) {
  const result = await pool.query(
    `
    SELECT
      wallet_balance AS "walletBalance"
    FROM health_partners
    WHERE user_id = $1
    `,
    [userId]
  );

  if (!result.rowCount) {
    throw new Error("Health Partner not found");
  }

  return result.rows[0];
}

export async function getPaymentHistory(userId: string) {
  const result = await pool.query(
    `
    SELECT
      t.id,
      t.type,
      t.amount,
      t.description,
      t.referral_id AS "referralId",
      t.created_at AS "createdAt"
    FROM transactions t
    INNER JOIN health_partners hp
      ON hp.id = t.health_partner_id
    WHERE hp.user_id = $1
    ORDER BY t.created_at DESC
    `,
    [userId]
  );

  return result.rows;
}

export async function saveBankAccount(
  userId: string,
  data: {
    accountHolderName: string;
    accountNumber: string;
    ifscCode: string;
    bankName: string;
  }
) {
  const hp = await pool.query(
    `SELECT id FROM health_partners WHERE user_id = $1`,
    [userId]
  );

  if (!hp.rowCount) {
    throw new Error("Health Partner not found");
  }

  const healthPartnerId = hp.rows[0].id;

  const result = await pool.query(
    `
    INSERT INTO bank_accounts (
      id,
      health_partner_id,
      account_holder_name,
      account_number,
      ifsc_code,
      bank_name
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (health_partner_id)
    DO UPDATE SET
      account_holder_name = EXCLUDED.account_holder_name,
      account_number = EXCLUDED.account_number,
      ifsc_code = EXCLUDED.ifsc_code,
      bank_name = EXCLUDED.bank_name,
      updated_at = NOW()
    RETURNING
      id,
      account_holder_name AS "accountHolderName",
      account_number AS "accountNumber",
      ifsc_code AS "ifscCode",
      bank_name AS "bankName",
      updated_at AS "updatedAt"
    `,
    [
      createId("bank"),
      healthPartnerId,
      data.accountHolderName,
      data.accountNumber,
      data.ifscCode,
      data.bankName,
    ]
  );

  return result.rows[0];
}

export async function withdraw(userId: string, amount: number) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const hp = await client.query(
      `
      SELECT id, wallet_balance
      FROM health_partners
      WHERE user_id = $1
      FOR UPDATE
      `,
      [userId]
    );

    if (!hp.rowCount) {
      throw new Error("Health Partner not found");
    }

    const healthPartnerId = hp.rows[0].id;
    const walletBalance = Number(hp.rows[0].wallet_balance);

    if (walletBalance < amount) {
      throw new Error("Insufficient wallet balance");
    }

    const bank = await client.query(
      `
      SELECT id
      FROM bank_accounts
      WHERE health_partner_id = $1
      `,
      [healthPartnerId]
    );

    if (!bank.rowCount) {
      throw new Error("Bank account is required before withdrawal");
    }

    const withdrawalId = createId("wd");

    await client.query(
      `
      UPDATE health_partners
      SET wallet_balance = wallet_balance - $1,
          updated_at = NOW()
      WHERE id = $2
      `,
      [amount, healthPartnerId]
    );

    const result = await client.query(
      `
      INSERT INTO withdrawals (
        id,
        health_partner_id,
        bank_account_id,
        amount,
        status
      )
      VALUES ($1, $2, $3, $4, 'PENDING')
      RETURNING
        id,
        amount,
        status,
        created_at AS "createdAt"
      `,
      [
        withdrawalId,
        healthPartnerId,
        bank.rows[0].id,
        amount,
      ]
    );

    await client.query("COMMIT");

    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getWithdrawals(userId: string) {
  const result = await pool.query(
    `
    SELECT
      w.id,
      w.amount,
      w.status,
      w.created_at AS "createdAt",
      w.processed_at AS "processedAt"
    FROM withdrawals w
    INNER JOIN health_partners hp
      ON hp.id = w.health_partner_id
    WHERE hp.user_id = $1
    ORDER BY w.created_at DESC
    `,
    [userId]
  );

  return result.rows;
}
