import { env } from "../config/env.js";

const OLLAMA_URL = env.OLLAMA_URL;

type OllamaJsonValue =
  | string
  | number
  | boolean
  | null
  | OllamaJsonValue[]
  | { [key: string]: OllamaJsonValue };

type OllamaBody = Record<string, OllamaJsonValue>;

export async function postOllamaJson<TResponse>(
  path: string,
  body: OllamaBody,
  errorLabel: string,
): Promise<TResponse> {
  const res = await fetch(`${OLLAMA_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`${errorLabel} failed: ${res.status}`);
  }

  return (await res.json()) as TResponse;
}

export async function postOllamaStream(
  path: string,
  body: OllamaBody,
  errorLabel: string,
): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(`${OLLAMA_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`${errorLabel} failed: ${res.status}`);
  }

  if (!res.body) {
    throw new Error(`${errorLabel} stream is unavailable`);
  }

  return res.body;
}

export async function checkOllamaConnection() {
  const res = await fetch(`${OLLAMA_URL}/api/tags`);

  if (!res.ok) {
    throw new Error(`Ollama readiness failed: ${res.status}`);
  }
}
