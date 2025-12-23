/**
 * Google Gemini Provider Adapter
 * Supports Gemini 1.5, 2.0, and other Gemini models
 */

import { BaseProviderAdapter, withRetry } from './base.js';
import type {
  CompletionRequest,
  CompletionResponse,
  ProviderConfig,
} from '../scripts/types.js';

interface GeminiContent {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

interface GeminiRequest {
  contents: GeminiContent[];
  systemInstruction?: {
    parts: Array<{ text: string }>;
  };
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
  };
}

interface GeminiCandidate {
  content: {
    parts: Array<{ text: string }>;
    role: string;
  };
  finishReason: string;
}

interface GeminiUsageMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

interface GeminiResponse {
  candidates: GeminiCandidate[];
  usageMetadata: GeminiUsageMetadata;
}

export class GoogleGeminiAdapter extends BaseProviderAdapter {
  constructor(config: ProviderConfig) {
    super(config);
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error(`Google API key not found. Set ${this.envKeyName} environment variable.`);
    }

    const baseUrl = this.config.base_url || 'https://generativelanguage.googleapis.com/v1beta';
    const url = `${baseUrl}/models/${request.model}:generateContent`;

    // Convert messages to Gemini format
    let systemInstruction: { parts: Array<{ text: string }> } | undefined;
    const contents: GeminiContent[] = [];

    for (const msg of request.messages) {
      if (msg.role === 'system') {
        systemInstruction = {
          parts: [{ text: msg.content }],
        };
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    const body: GeminiRequest = {
      contents,
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.max_tokens ?? 4096,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = systemInstruction;
    }

    const startTime = Date.now();

    const response = await withRetry(async () => {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Google Gemini API error (${res.status}): ${errorText}`);
      }

      return res.json() as Promise<GeminiResponse>;
    });

    const latencyMs = Date.now() - startTime;

    const candidate = response.candidates?.[0];
    if (!candidate) {
      throw new Error('Gemini returned no candidates');
    }

    const content = candidate.content.parts
      .map((part) => part.text)
      .join('');

    return {
      content,
      finish_reason: candidate.finishReason,
      usage: response.usageMetadata ? {
        prompt_tokens: response.usageMetadata.promptTokenCount,
        completion_tokens: response.usageMetadata.candidatesTokenCount,
        total_tokens: response.usageMetadata.totalTokenCount,
      } : undefined,
      latency_ms: latencyMs,
    };
  }
}
