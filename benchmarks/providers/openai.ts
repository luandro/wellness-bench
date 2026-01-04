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
  response_format?: {
    type: 'json_object' | 'json_schema';
    json_schema?: {
      name: string;
      strict: boolean;
      schema: Record<string, unknown>;
    };
  };
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

interface OpenAIResponsesInputContent {
  type: 'input_text';
  text: string;
}

interface OpenAIResponsesInputMessage {
  role: 'system' | 'user' | 'assistant';
  content: OpenAIResponsesInputContent[];
}

interface OpenAIResponsesRequest {
  model: string;
  input: OpenAIResponsesInputMessage[];
  temperature?: number;
  max_output_tokens?: number;
  text?: {
    format?: {
      type: 'json_object' | 'json_schema';
      name?: string;
      strict?: boolean;
      schema?: Record<string, unknown>;
    };
  };
}

interface OpenAIResponsesOutputContent {
  type: string;
  text?: string;
}

interface OpenAIResponsesOutputItem {
  type: string;
  role?: string;
  content?: OpenAIResponsesOutputContent[];
}

interface OpenAIResponsesUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

interface OpenAIResponsesResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  status?: string;
  output?: OpenAIResponsesOutputItem[];
  usage?: OpenAIResponsesUsage;
}

function isResponsesModel(modelId: string): boolean {
  return modelId.toLowerCase().startsWith('gpt-5');
}

function extractResponsesText(output?: OpenAIResponsesOutputItem[]): string {
  if (!output || output.length === 0) return '';
  const parts: string[] = [];

  for (const item of output) {
    if (!item.content) continue;
    for (const content of item.content) {
      if (content.type === 'output_text' && typeof content.text === 'string') {
        parts.push(content.text);
      }
    }
  }

  return parts.join('');
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
    const useResponses = isResponsesModel(request.model);
    const url = useResponses ? `${baseUrl}/responses` : `${baseUrl}/chat/completions`;

    let body: OpenAIRequest | OpenAIResponsesRequest;

    if (useResponses) {
      const inputMessages: OpenAIResponsesInputMessage[] = request.messages.map((msg) => ({
        role: msg.role,
        content: [{ type: 'input_text', text: msg.content }],
      }));

      const responsesBody: OpenAIResponsesRequest = {
        model: request.model,
        input: inputMessages,
        temperature: request.temperature ?? 0.7,
        max_output_tokens: request.max_tokens ?? 4096,
      };

      if (request.response_format?.type === 'json_object') {
        responsesBody.text = { format: { type: 'json_object' } };
      } else if (request.response_format?.type === 'json_schema' && request.response_format.json_schema) {
        responsesBody.text = {
          format: {
            type: 'json_schema',
            name: request.response_format.json_schema.name,
            strict: request.response_format.json_schema.strict,
            schema: request.response_format.json_schema.schema,
          },
        };
      }

      body = responsesBody;
    } else {
      const chatBody: OpenAIRequest = {
        model: request.model,
        messages: request.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: request.temperature ?? 0.7,
        max_tokens: request.max_tokens ?? 4096,
      };
      if (request.response_format) {
        chatBody.response_format = request.response_format;
      }
      body = chatBody;
    }

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

      return res.json() as Promise<OpenAIResponse | OpenAIResponsesResponse>;
    }, request.retry_options);

    const latencyMs = Date.now() - startTime;

    if (useResponses) {
      const responses = response as OpenAIResponsesResponse;
      const content = extractResponsesText(responses.output);
      if (!content) {
        throw new Error('OpenAI Responses API returned no text output');
      }

      return {
        content,
        finish_reason: responses.status ?? 'completed',
        usage: responses.usage ? {
          prompt_tokens: responses.usage.input_tokens,
          completion_tokens: responses.usage.output_tokens,
          total_tokens: responses.usage.total_tokens,
        } : undefined,
        latency_ms: latencyMs,
      };
    }

    const chat = response as OpenAIResponse;
    const choice = chat.choices[0];
    if (!choice) {
      throw new Error('OpenAI returned no choices');
    }

    return {
      content: choice.message.content,
      finish_reason: choice.finish_reason,
      usage: chat.usage ? {
        prompt_tokens: chat.usage.prompt_tokens,
        completion_tokens: chat.usage.completion_tokens,
        total_tokens: chat.usage.total_tokens,
      } : undefined,
      latency_ms: latencyMs,
    };
  }
}
