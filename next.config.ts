import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Impede o next dev de acrescentar um bloco ao AGENTS.md quando é iniciado por uma ferramenta de IA.
  agentRules: false,
};

export default nextConfig;
