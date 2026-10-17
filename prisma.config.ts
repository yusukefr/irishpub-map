import { defineConfig as definePostgresConfig } from "@prisma/orm-postgres/config";
import { definePrismaConfig } from "prisma/config";

export default definePrismaConfig({
  orm: definePostgresConfig({
    contract: "db/prisma/contract.prisma",
    output: "generated/prisma8",
  }),
});
