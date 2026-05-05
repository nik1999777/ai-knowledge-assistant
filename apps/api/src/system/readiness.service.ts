import { checkPostgresConnection } from "../db/postgres.client.js";
import { checkOllamaConnection } from "../clients/ollama.client.js";
import { checkQdrantConnection } from "../clients/qdrant.client.js";

type DependencyStatus = "up" | "down";

type DependencyCheckResult = {
  status: DependencyStatus;
  message?: string;
};

export type ReadinessResult = {
  status: "ready" | "degraded";
  dependencies: {
    postgres: DependencyCheckResult;
    qdrant: DependencyCheckResult;
    ollama: DependencyCheckResult;
  };
};

export async function getReadiness(): Promise<ReadinessResult> {
  const [postgres, qdrant, ollama] = await Promise.all([
    runDependencyCheck(checkPostgresConnection),
    runDependencyCheck(checkQdrantConnection),
    runDependencyCheck(checkOllamaConnection),
  ]);

  const status =
    postgres.status === "up" &&
    qdrant.status === "up" &&
    ollama.status === "up"
      ? "ready"
      : "degraded";

  return {
    status,
    dependencies: {
      postgres,
      qdrant,
      ollama,
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
