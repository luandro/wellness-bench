import { cn } from '@/lib/utils';

interface ProviderBadgeProps {
  provider: string;
  className?: string;
}

const providerConfig: Record<string, { label: string; class: string }> = {
  openai: { label: 'OpenAI', class: 'provider-openai' },
  anthropic: { label: 'Anthropic', class: 'provider-anthropic' },
  google: { label: 'Google', class: 'provider-google' },
  grok: { label: 'Grok', class: 'provider-grok' },
  deepseek: { label: 'DeepSeek', class: 'provider-deepseek' },
};

export function ProviderBadge({ provider, className }: ProviderBadgeProps) {
  const config = providerConfig[provider] || { label: provider, class: '' };
  
  return (
    <span className={cn('provider-badge', config.class, className)}>
      {config.label}
    </span>
  );
}
