import { checkPostgresConnection } from "../db/postgres.client.js";
import { checkQdrantConnection } from "../clients/qdrant.client.js";
import { llmProvider } from "../providers/index.js";
import { env } from "../config/env.js";

type DependencyStatus = "up" | "down" | "n/a";

type DependencyCheckResult = {
  status: DependencyStatus;
  message?: string;
};

export type ReadinessResult = {
  status: "ready" | "degraded";
  dependencies: {
    postgres: DependencyCheckResult;
    qdrant: DependencyCheckResult;
    llm: DependencyCheckResult;
  };
};

export async function getReadiness(): Promise<ReadinessResult> {
  const [postgres, qdrant, llm] = await Promise.all([
    runDependencyCheck(checkPostgresConnection),
    runDependencyCheck(checkQdrantConnection),
    runDependencyCheck(() => llmProvider.ping()),
  ]);

  const status =
    postgres.status === "up" && qdrant.status === "up" && llm.status === "up"
      ? "ready"
      : "degraded";

  return {
    status,
    dependencies: {
      postgres,
      qdrant,
      llm: { ...llm, message: llm.message ?? `provider: ${env.LLM_PROVIDER}` },
    },
  };
}

async function runDependencyCheck(
  check: () => Promise<void>,
): Promise<DependencyCheckResult> {
  try {
    await check();
    return { status: "up" };
  } catch (error) {
    return {
      status: "down",
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
