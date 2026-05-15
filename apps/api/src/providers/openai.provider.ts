import OpenAI from "openai";
import type { LLMProvider, StreamChunkHandler } from "./llm.provider.js";

export class OpenAIProvider implements LLMProvider {
  private readonly client: OpenAI;

  constructor(
    private readonly model: string,
    private readonly embedModel: string,
    apiKey: string,
    private readonly temperature: number = 0,
  ) {
    this.client = new OpenAI({ apiKey });
  }

  async generate(prompt: string, system?: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        ...(system ? [{ role: "system" as const, content: system }] : []),
        { role: "user" as const, content: prompt },
      ],
      temperature: this.temperature,
      stream: false,
    });

    return response.choices[0]?.message?.content ?? "";
  }

  async stream(prompt: string, onChunk: StreamChunkHandler, system?: string): Promise<void> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        ...(system ? [{ role: "system" as const, content: system }] : []),
        { role: "user" as const, content: prompt },
      ],
      temperature: this.temperature,
      stream: true,
    });

    for await (const chunk of response) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) onChunk(content);
    }
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: this.embedModel,
      input: text,
    });

    return response.data[0]?.embedding ?? [];
  }

  async ping(): Promise<void> {
    await this.client.models.list();
  }
}
