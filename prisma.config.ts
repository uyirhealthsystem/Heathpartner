import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Neon: migrations should use the direct (non "-pooler") connection
    // string. Set DIRECT_URL for that; otherwise DATABASE_URL is used.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || "",
  },
});
