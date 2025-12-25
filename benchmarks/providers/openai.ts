/**
 * OpenAI Provider Adapter
 * Supports GPT-4, GPT-4 Turbo, GPT-4o, and other OpenAI models
 */

import { BaseProviderAdapter, withRetry, sanitizeApiError } from './base.js';
import { OPENAI_API_BASE } from './constants.js';
import type {
  CompletionRequest,
  CompletionResponse,
  ProviderConfig,
} from '../scripts/types.js';

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: string };
}

interface OpenAIChoice {
  index: number;
  message: {
    role: string;
    content: string;
  };
  finish_reason: string;
}

interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage: OpenAIUsage;
}

export class OpenAIAdapter extends BaseProviderAdapter {
  constructor(config: ProviderConfig) {
    super(config);
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error(`OpenAI API key not found. Set ${this.envKeyName} environment variable.`);
    }

    const baseUrl = this.config.base_url || OPENAI_API_BASE;
    const url = `${baseUrl}/chat/completions`;

    const body: OpenAIRequest = {
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
        throw new Error(`OpenAI API error: ${sanitizeApiError(res.status, errorText)}`);
      }

      return res.json() as Promise<OpenAIResponse>;
    }, request.retry_options);

    const latencyMs = Date.now() - startTime;

    const choice = response.choices[0];
    if (!choice) {
      throw new Error('OpenAI returned no choices');
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
