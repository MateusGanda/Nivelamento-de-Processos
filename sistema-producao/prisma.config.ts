import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

const resultado = config({
  path: process.env.ENV_FILE || ".env",
});

if (resultado.error) {
  throw new Error("Não foi possível carregar o arquivo de ambiente.");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
