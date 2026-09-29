import { Pool } from "pg";
import { env } from "./env";

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.dbSsl
    ? {
        rejectUnauthorized: false,
      }
    : false,
});
