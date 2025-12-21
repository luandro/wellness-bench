/**
 * Grok (xAI) Provider Adapter
 * Supports Grok 2 and other xAI models
 * Uses OpenAI-compatible API format
 */

import { BaseProviderAdapter, withRetry } from './base.js';
import type {
  CompletionRequest,
  CompletionResponse,
  ProviderConfig,
} from '../scripts/types.js';

interface GrokMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GrokRequest {
  model: string;
  messages: GrokMessage[];
  temperature?: number;
  max_tokens?: number;
}

interface GrokChoice {
  index: number;
  message: {
    role: string;
    content: string;
  };
  finish_reason: string;
}

interface GrokUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface GrokResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: GrokChoice[];
  usage: GrokUsage;
}

export class GrokAdapter extends BaseProviderAdapter {
  constructor(config: ProviderConfig) {
    super(config);
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error(`xAI API key not found. Set ${this.envKeyName} environment variable.`);
    }

    const baseUrl = this.config.base_url || 'https://api.x.ai/v1';
    const url = `${baseUrl}/chat/completions`;

    const body: GrokRequest = {
      model: request.model,
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: request.temperature ?? 0.7,
      max_tokens: request.max_tokens ?? 4096,
    };

    const startTime = Date.now();

    const response = await withRetry(async () => {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Grok API error (${res.status}): ${errorText}`);
      }

      return res.json() as Promise<GrokResponse>;
    });

    const latencyMs = Date.now() - startTime;

    const choice = response.choices[0];
    if (!choice) {
      throw new Error('Grok returned no choices');
    }

    return {
      content: choice.message.content,
      finish_reason: choice.finish_reason,
      usage: response.usage ? {
        prompt_tokens: response.usage.prompt_tokens,
        completion_tokens: response.usage.completion_tokens,
        total_tokens: response.usage.total_tokens,
      } : undefined,
      latency_ms: latencyMs,
    };
  }
}
