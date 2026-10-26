// Applies pending Prisma migrations (`npm run db:migrate`). Also run by
// deploy/remote-release.sh and the Docker image.
//
// A database set up by the old init-db.ts has tables but no Prisma history,
// so `migrate deploy` refuses it (P3005). In that case run the idempotent
// 0_init SQL (fills in anything missing), record 0_init as applied, and retry.
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const prismaCli = path.join(
  path.dirname(require.resolve("prisma/package.json")),
  "build/index.js"
);

function prisma(args, { capture = false } = {}) {
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
  });

  if (capture) {
    process.stdout.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
  }

  return result;
}

function run(args) {
  if (prisma(args).status !== 0) {
    process.exit(1);
  }
}

const deploy = prisma(["migrate", "deploy"], { capture: true });

if (deploy.status !== 0) {
  if (!`${deploy.stdout}${deploy.stderr}`.includes("P3005")) {
    process.exit(1);
  }

  console.log("==> existing schema without Prisma history - baselining 0_init");
  run(["db", "execute", "--file", "prisma/migrations/0_init/migration.sql"]);
  run(["migrate", "resolve", "--applied", "0_init"]);
  run(["migrate", "deploy"]);
}
