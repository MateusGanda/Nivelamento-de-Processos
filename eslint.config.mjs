import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Arquivos gerados pelo Prisma:
    "src/prisma/contract.d.ts",
    "migrations/**",
    // Instruções para IA copiadas pelo "prisma skills sync":
    ".agents/**",
    ".claude/**",
    ".cursor/**",
    ".devin/**",
  ]),
]);

export default eslintConfig;
