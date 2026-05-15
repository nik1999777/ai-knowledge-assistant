export type StreamChunkHandler = (chunk: string) => void;

export interface LLMProvider {
  generate(prompt: string, system?: string): Promise<string>;
  stream(prompt: string, onChunk: StreamChunkHandler, system?: string): Promise<void>;
  embed(text: string): Promise<number[]>;
  ping(): Promise<void>;
}
