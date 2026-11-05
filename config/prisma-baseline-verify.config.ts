import { defineConfig as definePostgresConfig } from "@prisma/orm-postgres/config";
import { definePrismaConfig } from "prisma/config";

export default definePrismaConfig({
  parent: false,
  orm: definePostgresConfig({
    contract: "../db/prisma/contract.prisma",
    output: "../generated/prisma8",
    migrations: { dir: "../migrations" },
    db: { connection: process.env.PRISMA_BASELINE_VERIFY_DATABASE_URL! },
  }),
});
