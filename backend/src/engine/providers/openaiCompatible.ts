// OpenAI-compatible LLM + embedding clients. This is the ONLY place a concrete
// SDK or model name is touched; the rest of the engine depends on the
// LLMProvider / EmbeddingProvider interfaces (engine/types.ts). Both are driven
// entirely by env, so pointing at a different provider is a config change.

import OpenAI from "openai";
import type { EmbeddingProvider, LLMMessage, LLMProvider, Result } from "../types";

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`${name} must be set`);
  return value;
}

// --- LLM -------------------------------------------------------------------

class OpenAICompatibleLLM implements LLMProvider {
  private client: OpenAI;
  private model: string;
  private defaultMaxTokens: number;

  constructor() {
    this.client = new OpenAI({
      apiKey: requireEnv("LLM_API_KEY", process.env.OPENROUTER_API_KEY),
      baseURL: requireEnv("LLM_BASE_URL"),
    });
    this.model = requireEnv("LLM_MODEL");
    this.defaultMaxTokens = Number(process.env.LLM_MAX_TOKENS ?? 1024);
  }

  async complete(
    messages: LLMMessage[],
    opts?: { maxTokens?: number; temperature?: number }
  ): Promise<Result<string, "llm_error">> {
    try {
      const res = await this.client.chat.completions.create({
        model: this.model,
        messages,
        // Cap tokens: some gateways (OpenRouter) reserve credits up to max_tokens.
        max_tokens: opts?.maxTokens ?? this.defaultMaxTokens,
        temperature: opts?.temperature ?? 0,
      });
      const content = res.choices[0]?.message?.content?.trim();
      if (!content) return { ok: false, reason: "llm_error", detail: "empty completion" };
      return { ok: true, value: content };
    } catch (err) {
      return { ok: false, reason: "llm_error", detail: (err as Error).message };
    }
  }
}

// --- Embeddings ------------------------------------------------------------

class OpenAICompatibleEmbeddings implements EmbeddingProvider {
  private client: OpenAI;
  private model: string;

  constructor() {
    this.client = new OpenAI({
      apiKey: requireEnv("EMBEDDING_API_KEY", process.env.OPENROUTER_API_KEY),
      baseURL: requireEnv("EMBEDDING_BASE_URL"),
    });
    this.model = requireEnv("EMBEDDING_MODEL");
  }

  async embed(texts: string[]): Promise<Result<number[][], "embedding_error">> {
    if (texts.length === 0) return { ok: true, value: [] };
    try {
      const res = await this.client.embeddings.create({ model: this.model, input: texts });
      // The API preserves input order, but sort by index defensively.
      const vectors = [...res.data].sort((a, b) => a.index - b.index).map((d) => d.embedding as number[]);
      return { ok: true, value: vectors };
    } catch (err) {
      return { ok: false, reason: "embedding_error", detail: (err as Error).message };
    }
  }
}

// Lazily constructed singletons - env isn't read until first use, so importing
// the module doesn't require the vars to be set (keeps Day 1 routes bootable).
let llm: LLMProvider | undefined;
let embeddings: EmbeddingProvider | undefined;

export function getLLMProvider(): LLMProvider {
  return (llm ??= new OpenAICompatibleLLM());
}

export function getEmbeddingProvider(): EmbeddingProvider {
  return (embeddings ??= new OpenAICompatibleEmbeddings());
}
