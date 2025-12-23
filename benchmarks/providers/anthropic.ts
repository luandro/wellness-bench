/**
 * Anthropic Provider Adapter
 * Supports Claude 3, Claude 3.5, and Claude Sonnet 4 models
 */

import { BaseProviderAdapter, withRetry } from './base.js';
import type {
  CompletionRequest,
  CompletionResponse,
  ProviderConfig,
  ChatMessage,
} from '../scripts/types.js';

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicRequest {
  model: string;
  messages: AnthropicMessage[];
  system?: string;
  max_tokens: number;
  temperature?: number;
}

interface AnthropicContentBlock {
  type: 'text';
  text: string;
}

interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
}

interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: string;
  usage: AnthropicUsage;
}

export class AnthropicAdapter extends BaseProviderAdapter {
  private static readonly ANTHROPIC_VERSION = '2023-06-01';

  constructor(config: ProviderConfig) {
    super(config);
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error(`Anthropic API key not found. Set ${this.envKeyName} environment variable.`);
    }

    const baseUrl = this.config.base_url || 'https://api.anthropic.com/v1';
    const url = `${baseUrl}/messages`;

    // Extract system message and convert to Anthropic format
    let systemPrompt: string | undefined;
    const messages: AnthropicMessage[] = [];

    for (const msg of request.messages) {
      if (msg.role === 'system') {
        systemPrompt = msg.content;
      } else if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      } else {
        throw new Error(`Unsupported message role for Anthropic: ${msg.role}`);
      }
    }

    const body: AnthropicRequest = {
      model: request.model,
      messages,
      max_tokens: request.max_tokens ?? 4096,
      temperature: request.temperature ?? 0.7,
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    const startTime = Date.now();

    const response = await withRetry(async () => {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': AnthropicAdapter.ANTHROPIC_VERSION,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Anthropic API error (${res.status}): ${errorText}`);
      }

      return res.json() as Promise<AnthropicResponse>;
    });

    const latencyMs = Date.now() - startTime;

    // Combine content blocks
    const content = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');

    return {
      content,
      finish_reason: response.stop_reason,
      usage: response.usage ? {
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
        total_tokens: response.usage.input_tokens + response.usage.output_tokens,
      } : undefined,
      latency_ms: latencyMs,
    };
  }
}
