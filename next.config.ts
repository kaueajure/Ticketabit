import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Criado uma única vez pelo script de build para o Next identificar quando
  // uma navegação ainda pertence à versão anterior do deploy.
  deploymentId: process.env.NEXT_DEPLOYMENT_ID,
  reactStrictMode: true,
  experimental: {
    useTypeScriptCli: false,
  },
};

export default nextConfig;
