import type { LLMProvider, StreamChunkHandler } from "./llm.provider.js";

type OllamaJsonValue =
  | string
  | number
  | boolean
  | null
  | OllamaJsonValue[]
  | { [key: string]: OllamaJsonValue };

type GenerationOptions = {
  temperature?: number;
  seed?: number;
  num_predict?: number;
};

export class OllamaProvider implements LLMProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
    private readonly embedModel: string,
    private readonly options: GenerationOptions = {},
  ) {}

  async generate(prompt: string, system?: string): Promise<string> {
    const data = await this.post<{ response: string }>("/api/generate", {
      model: this.model,
      prompt,
      ...(system ? { system } : {}),
      options: this.options,
      stream: false,
    });

    return data.response;
  }

  async stream(prompt: string, onChunk: StreamChunkHandler, system?: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        prompt,
        ...(system ? { system } : {}),
        options: this.options,
        stream: true,
      }),
    });

    if (!res.ok) throw new Error(`Ollama stream failed: ${res.status}`);
    if (!res.body) throw new Error("Ollama stream unavailable");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const chunk = JSON.parse(trimmed) as { response?: string };
        if (chunk.response) onChunk(chunk.response);
      }

      if (done) break;
    }

    const finalLine = buffer.trim();
    if (finalLine) {
      const chunk = JSON.parse(finalLine) as { response?: string };
      if (chunk.response) onChunk(chunk.response);
    }
  }

  async embed(text: string): Promise<number[]> {
    const data = await this.post<{ embedding: number[] }>("/api/embeddings", {
      model: this.embedModel,
      prompt: text,
    });

    return data.embedding;
  }

  async ping(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/tags`);
    if (!res.ok) throw new Error(`Ollama readiness failed: ${res.status}`);
  }

  private async post<TResponse>(path: string, body: Record<string, OllamaJsonValue>): Promise<TResponse> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`Ollama request failed: ${res.status}`);
    return (await res.json()) as TResponse;
  }
}
