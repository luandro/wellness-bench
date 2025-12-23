/**
 * DeepSeek Provider Adapter
 * Supports DeepSeek Chat, Reasoner, and other DeepSeek models
 * Uses OpenAI-compatible API format
 */

import { BaseProviderAdapter, withRetry } from './base.js';
import { DEEPSEEK_API_BASE } from './constants.js';
import type {
  CompletionRequest,
  CompletionResponse,
  ProviderConfig,
} from '../scripts/types.js';

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DeepSeekRequest {
  model: string;
  messages: DeepSeekMessage[];
  temperature?: number;
  max_tokens?: number;
}

interface DeepSeekChoice {
  index: number;
  message: {
    role: string;
    content: string;
  };
  finish_reason: string;
}

interface DeepSeekUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface DeepSeekResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: DeepSeekChoice[];
  usage: DeepSeekUsage;
}

export class DeepSeekAdapter extends BaseProviderAdapter {
  constructor(config: ProviderConfig) {
    super(config);
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error(`DeepSeek API key not found. Set ${this.envKeyName} environment variable.`);
    }

    const baseUrl = this.config.base_url || DEEPSEEK_API_BASE;
    const url = `${baseUrl}/chat/completions`;

    const body: DeepSeekRequest = {
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
        throw new Error(`DeepSeek API error (${res.status}): ${errorText}`);
      }

      return res.json() as Promise<DeepSeekResponse>;
    }, request.retry_options);

    const latencyMs = Date.now() - startTime;

    const choice = response.choices[0];
    if (!choice) {
      throw new Error('DeepSeek returned no choices');
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
