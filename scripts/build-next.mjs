import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const configuredDeploymentId = process.env.NEXT_DEPLOYMENT_ID?.trim();
const generatedDeploymentId = `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
const deploymentId = configuredDeploymentId || generatedDeploymentId;
const nextCli = resolve("node_modules/next/dist/bin/next");

console.log(`Building deployment ${deploymentId}`);

const result = spawnSync(process.execPath, [nextCli, "build"], {
  env: {
    ...process.env,
    NEXT_DEPLOYMENT_ID: deploymentId,
  },
  stdio: "inherit",
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
