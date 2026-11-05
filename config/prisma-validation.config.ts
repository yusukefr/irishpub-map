import { defineConfig as definePostgresConfig } from "@prisma/orm-postgres/config";
import { definePrismaConfig } from "prisma/config";
import { assertDirectConnection } from "../scripts/lib/resolve-neon-target.mjs";

const databaseUrl = process.env.PRISMA_VALIDATION_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("PRISMA_VALIDATION_DATABASE_URL must be injected for an isolated validation Branch.");
}

assertDirectConnection(databaseUrl);
const databaseHost = new URL(databaseUrl).hostname.toLowerCase();
if (!databaseHost.endsWith(".neon.tech")) {
  throw new Error("Prisma validation requires a direct Neon database endpoint.");
}

export default definePrismaConfig({
  parent: false,
  orm: definePostgresConfig({
    contract: "../db/prisma/contract.prisma",
    output: "../generated/prisma8",
    migrations: { dir: "../migrations" },
    db: { connection: databaseUrl },
  }),
});
