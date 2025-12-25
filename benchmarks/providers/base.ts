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

    const parseEmbeddedJson = (input: string): unknown | null => {
      for (let i = 0; i < input.length; i++) {
        const startChar = input[i];
        if (startChar !== '{' && startChar !== '[') continue;

        const stack: string[] = [];
        let inString = false;
        let escape = false;

        for (let j = i; j < input.length; j++) {
          const ch = input[j];

          if (inString) {
            if (escape) {
              escape = false;
              continue;
            }
            if (ch === '\\') {
              escape = true;
              continue;
            }
            if (ch === '"') {
              inString = false;
            }
            continue;
          }

          if (ch === '"') {
            inString = true;
            continue;
          }

          if (ch === '{' || ch === '[') {
            stack.push(ch);
            continue;
          }

          if (ch === '}' || ch === ']') {
            const last = stack.pop();
            if (!last || (last === '{' && ch !== '}') || (last === '[' && ch !== ']')) {
              break;
            }
            if (stack.length === 0) {
              const candidate = input.slice(i, j + 1);
              try {
                return JSON.parse(candidate);
              } catch {
                break;
              }
            }
          }
        }
      }

      return null;
    };

    const embedded = parseEmbeddedJson(text);
    if (embedded !== null) {
      return embedded;
    }

    throw new Error('Could not parse JSON from response');
  }
}

/**
 * Sanitize API error messages to prevent leaking sensitive information.
 * Extracts only the HTTP status code and a generic error category.
 */
export function sanitizeApiError(status: number, rawError: string): string {
  // Map status codes to generic categories
  const statusMessages: Record<number, string> = {
    400: 'Bad request - check your input parameters',
    401: 'Authentication failed - check your API key',
    403: 'Access denied - your API key may lack required permissions',
    404: 'Resource not found - check the model name',
    429: 'Rate limit exceeded - please slow down requests',
    500: 'Server error - the API service is experiencing issues',
    502: 'Bad gateway - the API service is temporarily unavailable',
    503: 'Service unavailable - the API service is overloaded',
    504: 'Gateway timeout - the request took too long',
  };

  const genericMessage = statusMessages[status] || `Request failed with status ${status}`;

  // Log only safe metadata for debugging (never log raw error content)
  if (process.env.NODE_ENV === 'development') {
    console.debug(`[API Error ${status}] Error type: ${typeof rawError}, length: ${rawError.length} chars`);
  }

  return genericMessage;
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

