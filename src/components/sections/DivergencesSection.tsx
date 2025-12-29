import { useEffect, useRef, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useBenchmark } from '@/contexts/BenchmarkContext';
import { RandomUnderline } from '../ui/random-underline';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchResults } from '@/lib/basePath';
import type { PerQuestionResult, PerModelResult } from '@/types/benchmark';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Loader2 } from 'lucide-react';

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
  const { runDetails, isLoading: isCatalogLoading, biasFilters, anyBiasFilterActive } = useBenchmark();
  const [questionResults, setQuestionResults] = useState<Record<string, PerQuestionResult>>({});
  const [modelDetails, setModelDetails] = useState<Record<string, PerModelResult>>({});
  const [isLoading, setIsLoading] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const loadAllData = async () => {
      if (!runDetails) return;
      
      setIsLoading(true);
      try {
        const qResults: Record<string, PerQuestionResult> = {};
        const mDetails: Record<string, PerModelResult> = {};
        
        for (const qId of runDetails.question_ids) {
          const qPath = runDetails.file_map.per_question[qId];
          if (qPath) {
            const qData = await fetchResults<PerQuestionResult>(`${runDetails.run_id}/${qPath}`);
            qResults[qId] = qData;
            
            // Load detail for each model in this question (for quotes)
            for (const modelSummary of qData.models) {
              const key = `${modelSummary.provider_id}__${modelSummary.model_id}`;
              const mPath = runDetails.file_map.per_model[qId]?.[key];
              if (mPath && !mDetails[`${qId}__${key}`]) {
                const mData = await fetchResults<PerModelResult>(`${runDetails.run_id}/${mPath}`);
                mDetails[`${qId}__${key}`] = mData;
              }
            }
          }
        }
        setQuestionResults(qResults);
        setModelDetails(mDetails);
      } catch (err) {
        console.error('Failed to load data for divergences:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadAllData();
  }, [runDetails]);

  // Aggregate divergences from all questions
  const divergenceData: DivergenceBlock[] = useMemo(() => {
    return Object.values(questionResults).map(res => {
      const synthesis = res.synthesis['en'] || Object.values(res.synthesis)[0];
      if (!synthesis || !synthesis.key_divergences || synthesis.key_divergences.length === 0) {
        return null;
      }

      // Pick two representative models with contrasting bias profiles if possible
      const quotes: QuoteData[] = res.models.slice(0, 2).map(m => {
        const key = `${m.provider_id}__${m.model_id}`;
        const detail = modelDetails[`${res.question_id}__${key}`];
        
        const hasMarket = m.detected_bias_ids.includes('market');
        const hasPower = m.detected_bias_ids.includes('power');
        
        return {
          text: detail?.raw_answer.slice(0, 180) + '...' || 'No preview available',
          model: m.display_name.split(' (')[0],
          biasType: (hasMarket ? 'market' : hasPower ? 'systemic' : 'neutral') as 'neutral' | 'market' | 'systemic',
          biasCategories: m.detected_bias_ids as any,
        };
      });

      return {
        theme: res.question.title,
        description: synthesis.key_divergences[0] || 'Models show contrasting perspectives on this issue.',
        quotes,
      };
    }).filter(block => block !== null) as DivergenceBlock[];
  }, [questionResults, modelDetails]);

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
    return quote.biasCategories.some(cat => biasFilters[cat as keyof typeof biasFilters]);
  };

  const showSkeleton = isCatalogLoading;
  const showEmptyState = !isCatalogLoading && !runDetails;
  const showContent = !isCatalogLoading && runDetails;

  return (
    <TooltipProvider>
      <section ref={sectionRef} className="section-container">
        {/* Section header */}
        <div className="animate-on-scroll text-center mb-16">
          <h2 className="text-title font-serif text-foreground mb-4">
            <RandomUnderline strokeWidth={4}>Where models diverge</RandomUnderline>
          </h2>
          <p className="text-body-lg text-muted-foreground max-w-2xl mx-auto">
            These contrasts reveal underlying assumptions and ideological leanings — often invisible until compared.
          </p>
        </div>

        {showSkeleton ? (
          <div className="space-y-16">
            {[1, 2].map(i => (
              <div key={i} className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <div className="grid md:grid-cols-2 gap-6">
                  <Skeleton className="h-40 w-full rounded-xl" />
                  <Skeleton className="h-40 w-full rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : showEmptyState ? (
          <div className="text-center py-12 bg-card rounded-2xl border border-dashed border-border/60">
            <p className="text-muted-foreground max-w-sm mx-auto mb-4">
              No benchmark data available yet.
            </p>
            <p className="text-sm text-muted-foreground/70 max-w-md mx-auto">
              Select a benchmark run from the timeline above, or run your first benchmark to see divergence analysis.
            </p>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Analyzing model divergences...</p>
          </div>
        ) : divergenceData.length > 0 ? (
          /* Divergence blocks */
          <div className="space-y-16">
            {divergenceData.map((block, index) => (
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
        ) : (
          <div className="text-center py-12 bg-muted/30 rounded-2xl border border-dashed border-border/60">
            <p className="text-muted-foreground max-w-sm mx-auto italic">
              Comparative analysis is only available when multiple models are selected for a benchmark run.
            </p>
          </div>
        )}
      </section>
    </TooltipProvider>
  );
};
