/**
 * Base provider adapter and utilities
 */

import type {
  ProviderAdapter,
  CompletionRequest,
  CompletionResponse,
  ProviderConfig,
} from '../scripts/types.js';

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
export function getBackoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  const delay = baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * 0.1 * delay;
  return Math.min(delay + jitter, maxDelayMs);
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Rate limit errors
    if (message.includes('rate limit') || message.includes('429')) return true;
    // Temporary server errors
    if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504')) return true;
    // Network errors
    if (message.includes('econnreset') || message.includes('etimedout') || message.includes('network')) return true;
  }
  return false;
}

/**
 * Execute a function with retries
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === opts.maxRetries || !isRetryableError(error)) {
        throw lastError;
      }

      const delay = getBackoffDelay(attempt, opts.baseDelayMs, opts.maxDelayMs);
      console.warn(`Retry ${attempt + 1}/${opts.maxRetries} after ${delay}ms: ${lastError.message}`);
      await sleep(delay);
    }
  }

  throw lastError || new Error('Unknown error during retry');
}

/**
 * Parse JSON from a string, handling potential markdown code blocks
 */
export function parseJsonResponse(text: string): unknown {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // Try to extract from markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }

    // Try to find JSON object/array in the text
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]);
    }

    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      return JSON.parse(arrayMatch[0]);
    }

    throw new Error('Could not parse JSON from response');
  }
}

/**
 * Abstract base class for provider adapters
 */
export abstract class BaseProviderAdapter implements ProviderAdapter {
  readonly provider_id: string;
  readonly display_name: string;
  protected readonly config: ProviderConfig;
  protected readonly envKeyName: string;

  constructor(config: ProviderConfig) {
    this.provider_id = config.provider_id;
    this.display_name = config.display_name;
    this.config = config;
    this.envKeyName = config.env_key_name;
  }

  isAvailable(): boolean {
    return !!this.getApiKey();
  }

  getApiKey(): string | undefined {
    return process.env[this.envKeyName];
  }

  abstract complete(request: CompletionRequest): Promise<CompletionResponse>;

  /**
   * Build headers for the API request
   */
  protected buildHeaders(): Record<string, string> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error(`API key not found in environment variable: ${this.envKeyName}`);
    }

    if (this.config.auth_type === 'bearer') {
      return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      };
    } else {
      // For api-key type, child classes override this
      return {
        'Content-Type': 'application/json',
      };
    }
  }
}

/**
 * Create a provider adapter from a config
 */
export function createProviderAdapter(config: ProviderConfig): ProviderAdapter | null {
  // This function is implemented in the registry
  // Importing here would cause circular dependencies
  throw new Error('Use createAdapter from registry.ts instead');
}
