import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useBenchmark } from '@/contexts/BenchmarkContext';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface QuoteData {
  text: string;
  model: string;
  biasType: 'neutral' | 'market' | 'systemic';
  biasCategories?: ('market' | 'growth' | 'techno' | 'power')[];
}

interface DivergenceBlock {
  theme: string;
  description: string;
  quotes: QuoteData[];
}

// Mock data - would come from results in real implementation
const divergences: DivergenceBlock[] = [
  {
    theme: 'Growth & Markets',
    description: 'Some models frame growth as essential to solving crises, while others question growth itself.',
    quotes: [
      {
        text: 'Economic growth remains the most reliable path to poverty reduction and technological innovation.',
        model: 'GPT-4o',
        biasType: 'market',
        biasCategories: ['market', 'growth'],
      },
      {
        text: 'The assumption that growth solves problems ignores how growth patterns often cause them.',
        model: 'Claude',
        biasType: 'systemic',
      },
    ],
  },
  {
    theme: 'Technology & Solutions',
    description: 'Models vary in how much they rely on technological fixes versus systemic restructuring.',
    quotes: [
      {
        text: 'Advances in clean energy, carbon capture, and AI will provide the tools needed to address climate change.',
        model: 'Gemini',
        biasType: 'market',
        biasCategories: ['techno'],
      },
      {
        text: 'Technology can help, but without changes to power structures, it may simply optimize existing inequalities.',
        model: 'Claude',
        biasType: 'systemic',
        biasCategories: ['power'],
      },
    ],
  },
  {
    theme: 'Responsibility',
    description: 'Who or what gets named as responsible varies significantly across models.',
    quotes: [
      {
        text: 'Individual choices and consumer behavior are key drivers of environmental impact.',
        model: 'GPT-4o',
        biasType: 'market',
        biasCategories: ['market'],
      },
      {
        text: 'Framing responsibility as individual obscures the systemic forces that constrain choices.',
        model: 'DeepSeek',
        biasType: 'systemic',
        biasCategories: ['power'],
      },
    ],
  },
  {
    theme: 'Power & Inequality',
    description: 'How directly models name power imbalances and whose interests are served.',
    quotes: [
      {
        text: 'Stakeholder collaboration and public-private partnerships offer paths forward.',
        model: 'Gemini',
        biasType: 'neutral',
      },
      {
        text: 'Without naming who benefits from the status quo, solutions risk being captured by those same interests.',
        model: 'Claude',
        biasType: 'systemic',
        biasCategories: ['power'],
      },
    ],
  },
];

const biasTypeLabels = {
  neutral: 'Neutral',
  market: 'Market-leaning',
  systemic: 'Limits-aware',
};

const biasTypeTooltips = {
  neutral: 'This perspective doesn\'t strongly lean toward market or systemic framing',
  market: 'This perspective treats market mechanisms as natural or default solutions',
  systemic: 'This perspective centers systemic analysis and planetary limits',
};

export const DivergencesSection = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const { biasFilters, anyBiasFilterActive } = useBenchmark();

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1 }
    );

    const elements = sectionRef.current?.querySelectorAll('.animate-on-scroll');
    elements?.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  // Check if a quote should be highlighted based on active filters
  const shouldHighlight = (quote: QuoteData) => {
    if (!anyBiasFilterActive) return false;
    if (!quote.biasCategories) return false;
    return quote.biasCategories.some(cat => biasFilters[cat]);
  };

  return (
    <TooltipProvider>
      <section ref={sectionRef} className="section-container">
        {/* Section header */}
        <div className="animate-on-scroll text-center mb-16">
          <h2 className="text-title font-serif text-foreground mb-4">
            Where models diverge
          </h2>
          <p className="text-body-lg text-muted-foreground max-w-2xl mx-auto">
            These contrasts reveal underlying assumptions and ideological leanings — often invisible until compared.
          </p>
        </div>

        {/* Divergence blocks */}
        <div className="space-y-16">
          {divergences.map((block, index) => (
            <article
              key={block.theme}
              className="animate-on-scroll"
              style={{ transitionDelay: `${index * 0.1}s` }}
            >
              {/* Theme header */}
              <div className="mb-6">
                <h3 className="text-xl font-serif font-medium text-foreground mb-2">
                  {block.theme}
                </h3>
                <p className="text-muted-foreground">
                  {block.description}
                </p>
              </div>

              {/* Contrasting quotes */}
              <div className="grid md:grid-cols-2 gap-6">
                {block.quotes.map((quote, i) => {
                  const isHighlighted = shouldHighlight(quote);
                  
                  return (
                    <div
                      key={i}
                      className={cn(
                        'p-6 rounded-xl bg-card border hover-lift transition-all duration-300',
                        isHighlighted 
                          ? 'border-accent/50 ring-2 ring-accent/20 shadow-md' 
                          : 'border-border/40'
                      )}
                    >
                      {/* Quote */}
                      <blockquote className={cn(
                        'quote-block mb-4 transition-colors duration-300',
                        isHighlighted && 'text-foreground'
                      )}>
                        {quote.text}
                      </blockquote>

                      {/* Attribution */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">
                          {quote.model}
                        </span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={cn(
                              `bias-tag bias-${quote.biasType}`,
                              'cursor-help'
                            )}>
                              {biasTypeLabels[quote.biasType]}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[200px]">
                            <p className="text-xs">{biasTypeTooltips[quote.biasType]}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      </section>
    </TooltipProvider>
  );
};
