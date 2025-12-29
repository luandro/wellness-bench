import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Circle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RandomUnderline } from '../ui/random-underline';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ProviderLogo } from '@/components/ui/provider-logo';
import { BiasIndicatorTooltip, ScoreTooltip } from '@/components/ui/bias-toggle';
import { useBenchmark } from '@/contexts/BenchmarkContext';
import { fetchResults } from '@/lib/basePath';
import type { PerModelResult } from '@/types/benchmark';

interface BiasProfile {
  id: string;
  label: string;
  level: 0 | 1 | 2;
}

interface ModelData {
  id: string;
  name: string;
  providerId: string;
  modelVersion: string;
  summary: string;
  biasProfile: BiasProfile[];
  buenVivirAlignment: {
    score: number;
    assessment: string;
  };
  fullAnswer?: string;
  biasAnalysis?: string;
  coherenceNotes?: string;
  epistemicHumility?: string;
}

const ScoreDots = ({ score, max = 5, label }: { score: number; max?: number; label: string }) => (
  <ScoreTooltip
    score={score}
    label={label}
    description={score >= 4 ? 'Strong alignment with principles' : score >= 2 ? 'Partial alignment' : 'Limited alignment'}
  >
    <div className="flex items-center gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'score-dot',
            i < score ? 'filled' : 'empty'
          )}
        />
      ))}
      <span className="text-xs text-muted-foreground ml-2">{score}/{max}</span>
    </div>
  </ScoreTooltip>
);

const BiasIndicator = ({ level, label }: { level: 0 | 1 | 2; label: string }) => (
  <BiasIndicatorTooltip biasType={label} level={level}>
    <div className="flex items-center gap-0.5">
      {[0, 1].map((i) => (
        <Circle
          key={i}
          className={cn(
            'w-2.5 h-2.5 transition-all duration-300',
            i < level ? 'fill-accent text-accent' : 'text-muted-foreground/30'
          )}
        />
      ))}
    </div>
  </BiasIndicatorTooltip>
);

export const ModelDeepDiveSection = () => {
  const { runDetails, isLoading: isCatalogLoading } = useBenchmark();
  const [activeModelKey, setActiveModelKey] = useState<string | null>(null);
  const [modelDetails, setModelData] = useState<Record<string, PerModelResult>>({});
  const [isLoading, setIsLoading] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const { biasFilters } = useBenchmark();

  // Convert runDetails into ModelData list
  const models: ModelData[] = useMemo(() => {
    if (!runDetails) return [];

    return runDetails.models_included.map(m => {
      // Key must match output-generator.ts: sanitizeId(provider)__sanitizeId(model)
      const safeProviderId = m.provider_id.replace(/\//g, '__');
      const safeModelId = m.model_id.replace(/\//g, '__');
      const key = `${safeProviderId}__${safeModelId}`;
      
      // Clean up name by removing (via OpenRouter) etc.
      const cleanName = m.display_name.split(' (')[0];
      
      return {
        id: key,
        name: cleanName,
        providerId: m.provider_id,
        modelVersion: m.version || 'latest',
        summary: '', 
        biasProfile: [
          { id: 'market', label: 'Market bias', level: 0 },
          { id: 'growth', label: 'Growth normalization', level: 0 },
          { id: 'techno', label: 'Technosolutionism', level: 0 },
          { id: 'power', label: 'Power invisibility', level: 0 },
        ],
        buenVivirAlignment: {
          score: 0,
          assessment: 'No assessment loaded',
        }
      };
    });
  }, [runDetails]);

  useEffect(() => {
    if (models.length > 0 && !activeModelKey) {
      setActiveModelKey(models[0].id);
    }
  }, [models, activeModelKey]);

  useEffect(() => {
    const loadDetail = async () => {
      if (!runDetails || !activeModelKey) return;
      if (modelDetails[activeModelKey]) return;

      const firstQuestionId = runDetails.question_ids[0];
      const path = runDetails.file_map.per_model[firstQuestionId]?.[activeModelKey];
      
      if (!path) return;

      setIsLoading(true);
      try {
        const data = await fetchResults<PerModelResult>(`${runDetails.run_id}/${path}`);
        setModelData(prev => ({ ...prev, [activeModelKey]: data }));
      } catch (err) {
        console.error('Failed to load model details for deep dive:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadDetail();
  }, [runDetails, activeModelKey, modelDetails]);

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

  const currentModelData = models.find((m) => m.id === activeModelKey);
  const currentDetails = activeModelKey ? modelDetails[activeModelKey] : null;

  // Enhance model data with loaded details
  const displayModel = currentModelData ? {
    ...currentModelData,
    summary: currentDetails?.display_blocks?.['en']?.summary || currentModelData.summary,
    fullAnswer: currentDetails?.raw_answer,
    buenVivirAlignment: {
      score: currentDetails?.evaluations?.step_c?.alignment_score_0_5 ?? 0,
      assessment: currentDetails?.evaluations?.step_c?.explanation || 'No assessment available',
    },
    biasProfile: [
      { id: 'market', label: 'Market bias', level: (currentDetails?.evaluations?.step_b?.detected_biases?.some(b => b.id === 'market') ? 2 : 0) as 0|1|2 },
      { id: 'growth', label: 'Growth normalization', level: (currentDetails?.evaluations?.step_b?.detected_biases?.some(b => b.id === 'growth') ? 2 : 0) as 0|1|2 },
      { id: 'techno', label: 'Technosolutionism', level: (currentDetails?.evaluations?.step_b?.detected_biases?.some(b => b.id === 'techno') ? 2 : 0) as 0|1|2 },
      { id: 'power', label: 'Power invisibility', level: (currentDetails?.evaluations?.step_b?.detected_biases?.some(b => b.id === 'power') ? 2 : 0) as 0|1|2 },
    ],
    biasAnalysis: currentDetails?.evaluations?.step_b?.overall_bias_profile_summary,
    coherenceNotes: currentDetails?.evaluations?.step_d?.explanation,
    epistemicHumility: currentDetails?.evaluations?.step_e?.explanation,
  } : null;

  const showSkeleton = isCatalogLoading || (isLoading && !currentDetails);
  const showEmptyState = !isCatalogLoading && (!runDetails || models.length === 0);
  const showContent = !isCatalogLoading && runDetails && models.length > 0;

  return (
    <section
      ref={sectionRef}
      className="section-wide py-32"
      style={{ background: 'var(--gradient-section)' }}
    >
      <div className="max-w-4xl mx-auto px-6">
        {/* Section header */}
        <div className="animate-on-scroll text-center mb-12">
          <h2 className="text-title font-serif text-foreground mb-4">
            <RandomUnderline strokeWidth={4}>Model Deep Dive</RandomUnderline>
          </h2>
          <p className="text-body-lg text-muted-foreground max-w-2xl mx-auto">
            Explore detailed analysis for each model. Select a provider to see their full response and evaluation.
          </p>
        </div>

        {showSkeleton ? (
          <>
            <div className="flex justify-center gap-2 mb-12">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-10 w-24 rounded-xl" />)}
            </div>
            <Skeleton className="h-96 w-full rounded-2xl" />
          </>
        ) : showEmptyState ? (
          <div className="text-center py-12 bg-card rounded-2xl border border-dashed border-border/60">
            <p className="text-muted-foreground max-w-sm mx-auto mb-4">
              No model data available yet.
            </p>
            <p className="text-sm text-muted-foreground/70 max-w-md mx-auto">
              Select a benchmark run from the timeline above, or run your first benchmark to see detailed model analysis.
            </p>
          </div>
        ) : (
          <>
            {/* Model tabs with logos */}
            <div className="animate-on-scroll flex flex-wrap justify-center gap-2 mb-12">
              {models.map((model) => (
            <button
              key={model.id}
              onClick={() => setActiveModelKey(model.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300',
                activeModelKey === model.id 
                  ? 'bg-card shadow-md border border-border/60 text-foreground' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent'
              )}
            >
              <ProviderLogo provider={model.providerId} size="sm" />
              <span className="text-sm font-medium">{model.name}</span>
            </button>
          ))}
        </div>

        {/* Model content with fade transition */}
        {displayModel && (
          <div 
            key={activeModelKey}
            className="animate-on-scroll visible bg-card rounded-2xl border border-border/40 p-8 shadow-sm animate-fade-in"
          >
            {/* Header with logo */}
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border/30">
              <ProviderLogo provider={displayModel.providerId} size="lg" />
              <div>
                <h3 className="text-lg font-serif font-medium text-foreground">
                  {displayModel.name}
                </h3>
                <span className="text-xs text-muted-foreground">{displayModel.modelVersion}</span>
              </div>
            </div>

            {isLoading ? (
              <div className="py-20 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {/* Summary */}
                <div className="mb-8">
                  <h4 className="text-sm font-medium text-foreground mb-3">Summary</h4>
                  <p className="text-muted-foreground leading-relaxed">
                    {displayModel.summary || 'Select a model to view analysis.'}
                  </p>
                </div>

                {/* Bias profile */}
                <div className="mb-8">
                  <h4 className="text-sm font-medium text-foreground mb-4">Bias Profile</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {displayModel.biasProfile.map((bias) => {
                      const isHighlighted = biasFilters[bias.id as keyof typeof biasFilters];
                      return (
                        <div 
                          key={bias.id} 
                          className={cn(
                            'flex flex-col gap-1.5 p-2 rounded-lg transition-all duration-300',
                            isHighlighted && bias.level > 0 && 'bg-accent/10 ring-1 ring-accent/30'
                          )}
                        >
                          <span className="text-xs text-muted-foreground">{bias.label}</span>
                          <BiasIndicator level={bias.level} label={bias.label} />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Buen Vivir alignment */}
                <div className="mb-8 p-4 rounded-xl bg-secondary/30 border border-border/30">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-foreground">Buen Vivir Alignment</h4>
                    <ScoreDots score={displayModel.buenVivirAlignment.score} label="Buen Vivir Alignment" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {displayModel.buenVivirAlignment.assessment}
                  </p>
                </div>

                {/* Expandable sections - lazy loaded */}
                <Accordion type="single" collapsible className="space-y-2">
                  {displayModel.fullAnswer && (
                    <AccordionItem value="full-answer" className="border-border/40">
                      <AccordionTrigger className="expand-trigger py-3 hover:no-underline">
                        <span className="text-sm font-medium">Full Answer</span>
                      </AccordionTrigger>
                      <AccordionContent className="pt-2 pb-4">
                        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                          {displayModel.fullAnswer}
                        </p>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {displayModel.biasAnalysis && (
                    <AccordionItem value="bias-analysis" className="border-border/40">
                      <AccordionTrigger className="expand-trigger py-3 hover:no-underline">
                        <span className="text-sm font-medium">Bias Analysis</span>
                      </AccordionTrigger>
                      <AccordionContent className="pt-2 pb-4">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {displayModel.biasAnalysis}
                        </p>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {displayModel.coherenceNotes && (
                    <AccordionItem value="coherence" className="border-border/40">
                      <AccordionTrigger className="expand-trigger py-3 hover:no-underline">
                        <span className="text-sm font-medium">Coherence & Realism</span>
                      </AccordionTrigger>
                      <AccordionContent className="pt-2 pb-4">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {displayModel.coherenceNotes}
                        </p>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {displayModel.epistemicHumility && (
                    <AccordionItem value="humility" className="border-border/40">
                      <AccordionTrigger className="expand-trigger py-3 hover:no-underline">
                        <span className="text-sm font-medium">Epistemic Humility</span>
                      </AccordionTrigger>
                      <AccordionContent className="pt-2 pb-4">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {displayModel.epistemicHumility}
                        </p>
                      </AccordionContent>
                    </AccordionItem>
                  )}
                </Accordion>
              </>
            )}
          </div>
        )}
          </>
        )}
      </div>
    </section>
  );
};
