/**
 * Provider Registry
 * Factory for creating provider adapters from configuration
 */

import type { ProviderAdapter, ProviderConfig } from '../scripts/types.js';
import { OpenAIAdapter } from './openai.js';
import { AnthropicAdapter } from './anthropic.js';
import { GoogleGeminiAdapter } from './google.js';
import { GrokAdapter } from './grok.js';
import { DeepSeekAdapter } from './deepseek.js';

type AdapterConstructor = new (config: ProviderConfig) => ProviderAdapter;

const ADAPTER_REGISTRY: Record<string, AdapterConstructor> = {
  openai: OpenAIAdapter,
  anthropic: AnthropicAdapter,
  google: GoogleGeminiAdapter,
  grok: GrokAdapter,
  deepseek: DeepSeekAdapter,
};

/**
 * Create a provider adapter from a provider configuration
 */
export function createAdapter(config: ProviderConfig): ProviderAdapter {
  const AdapterClass = ADAPTER_REGISTRY[config.provider_id];
  if (!AdapterClass) {
    throw new Error(`Unknown provider: ${config.provider_id}. Available providers: ${Object.keys(ADAPTER_REGISTRY).join(', ')}`);
  }
  return new AdapterClass(config);
}

/**
 * Get list of supported provider IDs
 */
export function getSupportedProviders(): string[] {
  return Object.keys(ADAPTER_REGISTRY);
}

/**
 * Check if a provider is supported
 */
export function isProviderSupported(providerId: string): boolean {
  return providerId in ADAPTER_REGISTRY;
}

/**
 * Create adapters for all configured providers
 * Returns only adapters with available API keys
 */
export function createAvailableAdapters(
  configs: ProviderConfig[],
  options: { requireAll?: boolean; filterProviders?: string[] } = {}
): Map<string, ProviderAdapter> {
  const adapters = new Map<string, ProviderAdapter>();
  const missingKeys: string[] = [];

  for (const config of configs) {
    // Skip if filtered out
    if (options.filterProviders && !options.filterProviders.includes(config.provider_id)) {
      continue;
    }

    // Skip if provider not supported
    if (!isProviderSupported(config.provider_id)) {
      console.warn(`Skipping unsupported provider: ${config.provider_id}`);
      continue;
    }

    const adapter = createAdapter(config);

    if (adapter.isAvailable()) {
      adapters.set(config.provider_id, adapter);
    } else {
      missingKeys.push(`${config.provider_id} (${config.env_key_name})`);
    }
  }

  if (options.requireAll && missingKeys.length > 0) {
    throw new Error(
      `Missing API keys for required providers:\n${missingKeys.map((k) => `  - ${k}`).join('\n')}\n\n` +
      `Set the environment variables and try again.`
    );
  }

  return adapters;
}

/**
 * Validate that required providers have API keys
 */
export function validateProviderKeys(
  configs: ProviderConfig[],
  requiredProviderIds: string[]
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  for (const providerId of requiredProviderIds) {
    const config = configs.find((c) => c.provider_id === providerId);
    if (!config) {
      missing.push(`${providerId} (not configured)`);
      continue;
    }

    const apiKey = process.env[config.env_key_name];
    if (!apiKey) {
      missing.push(`${providerId} (${config.env_key_name})`);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}
