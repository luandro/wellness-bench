/**
 * OpenRouter Provider Adapter
 * Supports all models available on OpenRouter
 */

import { BaseProviderAdapter, withRetry } from './base.js';
import { OPENROUTER_API_BASE } from './constants.js';
import type {
  CompletionRequest,
  CompletionResponse,
  ProviderConfig,
  ProviderAdapter,
} from '../scripts/types.js';

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: string };
  // OpenRouter specific headers/options
  transforms?: string[];
  route?: 'fallback';
}

interface OpenRouterChoice {
  index: number;
  message: {
    role: string;
    content: string;
  };
  finish_reason: string;
}

interface OpenRouterUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface OpenRouterResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenRouterChoice[];
  usage: OpenRouterUsage;
}

export class OpenRouterAdapter extends BaseProviderAdapter {
  constructor(config: ProviderConfig) {
    super(config);
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error(`OpenRouter API key not found. Set ${this.envKeyName} environment variable.`);
    }

    const baseUrl = this.config.base_url || OPENROUTER_API_BASE;
    const url = `${baseUrl}/chat/completions`;

    // Map model ID to OpenRouter format if needed
    // If the model ID doesn't contain a slash, it might be an alias or a direct model
    let modelId = request.model;
    
    // Simple heuristic: if we're calling via OpenRouter but the model ID 
    // is from another provider, we might need to prefix it.
    // However, it's better to let the user specify the full OpenRouter model ID
    // or handle the mapping in the registry.

    const body: OpenRouterRequest = {
      model: modelId,
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
          'HTTP-Referer': 'https://github.com/luandro/wellness-bench', // Required by OpenRouter
          'X-Title': 'Wellness AI Benchmark', // Optional but good practice
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`OpenRouter API error (${res.status}): ${errorText}`);
      }

      return res.json() as Promise<OpenRouterResponse>;
    }, request.retry_options);

    const latencyMs = Date.now() - startTime;

    const choice = response.choices[0];
    if (!choice) {
      throw new Error('OpenRouter returned no choices');
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

/**
 * A proxy adapter that wraps an OpenRouterAdapter but translates 
 * model IDs from other providers to OpenRouter's format.
 */
export class OpenRouterProxyAdapter implements ProviderAdapter {
  readonly provider_id: string;
  readonly display_name: string;
  private readonly adapter: OpenRouterAdapter;
  private readonly originalProviderId: string;

  constructor(adapter: OpenRouterAdapter, originalProviderId: string) {
    this.adapter = adapter;
    this.originalProviderId = originalProviderId;
    this.provider_id = originalProviderId;
    this.display_name = `${adapter.display_name} (Proxy for ${originalProviderId})`;
  }

  isAvailable(): boolean {
    return this.adapter.isAvailable();
  }

  getApiKey(): string | undefined {
    return this.adapter.getApiKey();
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    // Translate model ID if it doesn't already have a prefix
    let translatedModel = request.model;
    if (!translatedModel.includes('/')) {
      switch (this.originalProviderId) {
        case 'openai':
          translatedModel = `openai/${request.model}`;
          break;
        case 'anthropic':
          // OpenRouter uses claude-3-opus-20240229 format often
          // but prefixed with anthropic/
          translatedModel = `anthropic/${request.model}`;
          break;
        case 'google':
          translatedModel = `google/${request.model}`;
          break;
        case 'grok':
          translatedModel = `x-ai/${request.model}`;
          break;
        case 'deepseek':
          translatedModel = `deepseek/${request.model}`;
          break;
      }
    }

    return this.adapter.complete({
      ...request,
      model: translatedModel,
    });
  }
}
