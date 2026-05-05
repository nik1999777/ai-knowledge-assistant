import { env } from "../config/env.js";
import { postOllamaJson, postOllamaStream } from "../clients/ollama.client.js";

type StreamChunkHandler = (chunk: string) => void;

export async function askLLM(prompt: string): Promise<string> {
  const data = await postOllamaJson<{ response: string }>(
    "/api/generate",
    {
      model: env.OLLAMA_LLM_MODEL,
      prompt,
      stream: false,
    },
    "LLM request",
  );

  return data.response;
}

export async function streamLLM(
  prompt: string,
  onChunk: StreamChunkHandler,
): Promise<void> {
  const stream = await postOllamaStream(
    "/api/generate",
    {
      model: env.OLLAMA_LLM_MODEL,
      prompt,
      stream: true,
    },
    "LLM request",
  );

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    buffer += decoder.decode(value, { stream: !done });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (!trimmedLine) {
        continue;
      }

      const data = JSON.parse(trimmedLine) as {
        response?: string;
        done?: boolean;
      };

      if (data.response) {
        onChunk(data.response);
      }
    }

    if (done) {
      break;
    }
  }

  const finalLine = buffer.trim();

  if (!finalLine) {
    return;
  }

  const data = JSON.parse(finalLine) as {
    response?: string;
    done?: boolean;
  };

  if (data.response) {
    onChunk(data.response);
  }
}
