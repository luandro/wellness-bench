import { cn } from '@/lib/utils';

interface ProviderLogoProps {
  provider: 'openai' | 'anthropic' | 'google' | 'grok' | 'deepseek';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showName?: boolean;
}

const providerNames: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Claude',
  google: 'Gemini',
  grok: 'Grok',
  deepseek: 'DeepSeek',
};

const sizes = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

// Muted monochrome SVG logos for each provider
const logos = {
  openai: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.896zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08-4.778 2.758a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
    </svg>
  ),
  anthropic: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.304 3.541h-3.672l6.696 16.918h3.672l-6.696-16.918zM6.696 3.541L0 20.459h3.672l1.344-3.541h6.804l1.344 3.541h3.672L10.14 3.541H6.696zm-.252 10.377l2.196-5.787 2.196 5.787H6.444z"/>
    </svg>
  ),
  google: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 11v2.4h3.97c-.16 1.03-1.2 3.02-3.97 3.02-2.39 0-4.34-1.98-4.34-4.42S9.61 7.58 12 7.58c1.36 0 2.27.58 2.79 1.08l1.9-1.83C15.47 5.69 13.89 5 12 5 8.13 5 5 8.13 5 12s3.13 7 7 7c4.04 0 6.72-2.84 6.72-6.84 0-.46-.05-.81-.11-1.16H12z"/>
    </svg>
  ),
  grok: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932L18.901 1.153ZM17.61 20.644h2.039L6.486 3.24H4.298L17.61 20.644Z"/>
    </svg>
  ),
  deepseek: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
};

export function ProviderLogo({ provider, size = 'md', className, showName = false }: ProviderLogoProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div 
        className={cn(
          sizes[size],
          'text-muted-foreground transition-colors',
          provider === 'openai' && 'text-provider-openai',
          provider === 'anthropic' && 'text-provider-anthropic',
          provider === 'google' && 'text-provider-google',
          provider === 'grok' && 'text-provider-grok',
          provider === 'deepseek' && 'text-provider-deepseek',
        )}
      >
        {logos[provider]}
      </div>
      {showName && (
        <span className="text-sm font-medium text-foreground">
          {providerNames[provider]}
        </span>
      )}
    </div>
  );
}

export function ProviderLogoWithBadge({ 
  provider, 
  size = 'md',
  isActive = false,
  className 
}: ProviderLogoProps & { isActive?: boolean }) {
  return (
    <div 
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200',
        isActive 
          ? 'bg-card shadow-sm border border-border/60' 
          : 'hover:bg-muted/50',
        className
      )}
    >
      <ProviderLogo provider={provider} size={size} />
      <span className={cn(
        'text-sm font-medium transition-colors',
        isActive ? 'text-foreground' : 'text-muted-foreground'
      )}>
        {providerNames[provider]}
      </span>
    </div>
  );
}
