import { useBenchmark, BiasFilters } from '@/contexts/BenchmarkContext';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { TrendingUp, Cpu, Building2, Eye } from 'lucide-react';

interface BiasToggleProps {
  className?: string;
}

const biasConfig: {
  key: keyof BiasFilters;
  label: string;
  tooltip: string;
  icon: React.ReactNode;
}[] = [
  {
    key: 'market',
    label: 'Market',
    tooltip: 'Highlights when models assume markets are the default solution',
    icon: <TrendingUp className="w-3.5 h-3.5" />,
  },
  {
    key: 'growth',
    label: 'Growth',
    tooltip: 'Highlights when infinite growth is treated as necessary or desirable',
    icon: <TrendingUp className="w-3.5 h-3.5" />,
  },
  {
    key: 'techno',
    label: 'Tech',
    tooltip: 'Highlights overreliance on technological fixes without systemic change',
    icon: <Cpu className="w-3.5 h-3.5" />,
  },
  {
    key: 'power',
    label: 'Power',
    tooltip: 'Highlights when power structures and inequalities are made invisible',
    icon: <Eye className="w-3.5 h-3.5" />,
  },
];

export function BiasToggleGroup({ className }: BiasToggleProps) {
  const { biasFilters, toggleBiasFilter, anyBiasFilterActive } = useBenchmark();

  return (
    <TooltipProvider>
      <div className={cn('flex flex-wrap items-center gap-2', className)}>
        <span className="text-xs text-muted-foreground mr-1">Highlight bias:</span>
        {biasConfig.map(({ key, label, tooltip, icon }) => (
          <Tooltip key={key}>
            <TooltipTrigger asChild>
              <button
                onClick={() => toggleBiasFilter(key)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                  'border',
                  biasFilters[key]
                    ? 'bg-accent/20 border-accent/40 text-accent-foreground'
                    : 'bg-transparent border-border/40 text-muted-foreground hover:border-border hover:text-foreground'
                )}
              >
                {icon}
                {label}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[200px] text-center">
              <p className="text-xs">{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        ))}
        
        {anyBiasFilterActive && (
          <button
            onClick={() => {
              biasConfig.forEach(({ key }) => {
                if (biasFilters[key]) toggleBiasFilter(key);
              });
            }}
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline ml-1"
          >
            Clear
          </button>
        )}
      </div>
    </TooltipProvider>
  );
}

// Tooltip for score indicators
interface ScoreTooltipProps {
  children: React.ReactNode;
  score: number;
  label: string;
  description: string;
}

export function ScoreTooltip({ children, score, label, description }: ScoreTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help">{children}</div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px]">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium text-xs">{label}</span>
              <span className="text-xs text-muted-foreground">{score}/5</span>
            </div>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Tooltip for bias indicators
interface BiasIndicatorTooltipProps {
  children: React.ReactNode;
  biasType: string;
  level: 0 | 1 | 2;
}

const biasDescriptions: Record<string, Record<0 | 1 | 2, string>> = {
  'Market bias': {
    0: 'Little to no market-default assumptions detected',
    1: 'Some reliance on market mechanisms as natural solutions',
    2: 'Strong tendency to treat markets as the default answer',
  },
  'Growth normalization': {
    0: 'Questions or challenges growth assumptions',
    1: 'Mixed view on growth as necessary',
    2: 'Treats continuous growth as essential and unquestionable',
  },
  'Technosolutionism': {
    0: 'Recognizes limits of technological fixes',
    1: 'Some overreliance on technology',
    2: 'Strong belief technology alone can solve systemic problems',
  },
  'Power invisibility': {
    0: 'Explicitly names power structures and inequalities',
    1: 'Partially acknowledges power dynamics',
    2: 'Rarely mentions or obscures power imbalances',
  },
};

export function BiasIndicatorTooltip({ children, biasType, level }: BiasIndicatorTooltipProps) {
  const description = biasDescriptions[biasType]?.[level] || 'No description available';
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help">{children}</div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px]">
          <p className="text-xs">{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
