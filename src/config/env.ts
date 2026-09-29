import dotenv from "dotenv";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing in .env");
}

export const env = {
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL,
  // SSL on by default (Neon / RDS). Set DB_SSL=false for a local Postgres.
  dbSsl: process.env.DB_SSL !== "false",
};
