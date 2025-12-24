import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProviderBadge } from '@/components/ui/provider-badge';
import { ScoreBadge } from '@/components/ui/score-badge';
import { JsonViewer } from '@/components/ui/json-viewer';
import { useBenchmark } from '@/contexts/BenchmarkContext';
import { fetchResults } from '@/lib/basePath';
import type { Question, PerQuestionResult, PerModelResult } from '@/types/benchmark';
import { ChevronDown, ChevronUp, Quote, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuestionResultsProps {
  question: Question;
}

export function QuestionResults({ question }: QuestionResultsProps) {
  const { runDetails } = useBenchmark();
  const [questionData, setQuestionData] = useState<PerQuestionResult | null>(null);
  const [modelData, setModelData] = useState<Record<string, PerModelResult>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function loadData() {
      if (!runDetails) return;
      
      setIsLoading(true);
      try {
        const path = runDetails.file_map.per_question[question.id];
        if (path) {
          const data = await fetchResults<PerQuestionResult>(`${runDetails.run_id}/${path}`);
          setQuestionData(data);
          
          // Reset model data when question changes
          setModelData({});
        }
      } catch (err) {
        console.error('Failed to load question results:', err);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadData();
  }, [runDetails, question.id]);

  const loadModelDetail = async (providerId: string, modelId: string) => {
    if (!runDetails || !questionData) return;
    
    const key = `${providerId}__${modelId}`;
    if (modelData[key]) return; // Already loaded
    
    try {
      const path = runDetails.file_map.per_model[question.id][key];
      if (path) {
        const data = await fetchResults<PerModelResult>(`${runDetails.run_id}/${path}`);
        setModelData(prev => ({ ...prev, [key]: data }));
      }
    } catch (err) {
      console.error(`Failed to load model details for ${key}:`, err);
    }
  };

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (isLoading) {
    return (
      <Card className="card-elevated">
        <CardContent className="py-20 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
          <p className="text-muted-foreground">Loading results...</p>
        </CardContent>
      </Card>
    );
  }

  if (!questionData || questionData.models.length === 0) {
    return (
      <Card className="card-elevated">
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">No results available for this question yet.</p>
        </CardContent>
      </Card>
    );
  }

  const synthesis = questionData.synthesis['en'] || Object.values(questionData.synthesis)[0];

  return (
    <div className="space-y-6">
      {/* Synthesis Summary */}
      {synthesis && (synthesis.common_ground?.length > 0 || synthesis.key_divergences?.length > 0) && (
        <Card className="card-elevated border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary" />
              Synthesis Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {synthesis.common_ground?.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">Common Ground</h4>
                <ul className="space-y-1">
                  {synthesis.common_ground.map((item, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex gap-2">
                      <span className="text-primary">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {synthesis.key_divergences?.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">Key Divergences</h4>
                <ul className="space-y-1">
                  {synthesis.key_divergences.map((item, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex gap-2">
                      <span className="text-accent">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {synthesis.salient_bias_patterns?.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">Salient Bias Patterns</h4>
                <ul className="space-y-1">
                  {synthesis.salient_bias_patterns.map((item, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex gap-2">
                      <AlertCircle className="w-3 h-3 text-warning mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Provider Results Tabs */}
      <Card className="card-elevated">
        <Tabs 
          defaultValue={`${questionData.models[0].provider_id}__${questionData.models[0].model_id}`}
          onValueChange={(value) => {
            const [pId, mId] = value.split('__');
            loadModelDetail(pId, mId);
          }}
        >
          <CardHeader>
            <TabsList className="w-full justify-start bg-muted/50 p-1 flex-wrap h-auto gap-1">
              {questionData.models.map((model) => (
                <TabsTrigger
                  key={`${model.provider_id}__${model.model_id}`}
                  value={`${model.provider_id}__${model.model_id}`}
                  className="data-[state=active]:bg-background"
                >
                  {model.display_name}
                </TabsTrigger>
              ))}
            </TabsList>
          </CardHeader>
          
          <CardContent>
            {questionData.models.map((modelSummary) => {
              const key = `${modelSummary.provider_id}__${modelSummary.model_id}`;
              const result = modelData[key];
              
              return (
                <TabsContent key={key} value={key} className="space-y-4">
                  {/* Scores Overview */}
                  <div className="flex flex-wrap gap-4 pb-4 border-b border-border">
                    <ScoreBadge score={modelSummary.scores.buen_vivir_alignment} label="Buen Vivir" />
                    <ScoreBadge score={modelSummary.scores.coherence} label="Coherence" />
                    <ScoreBadge score={modelSummary.scores.epistemic_humility} label="Humility" />
                    <Badge variant="outline">
                      Biases: {modelSummary.scores.bias_count}
                    </Badge>
                  </div>
                  
                  {!result ? (
                    <div className="py-12 flex justify-center">
                      <Button 
                        variant="outline" 
                        onClick={() => loadModelDetail(modelSummary.provider_id, modelSummary.model_id)}
                      >
                        Load Full Details
                      </Button>
                    </div>
                  ) : (
                    <>
                      {/* Raw Answer */}
                      <CollapsibleSection
                        title="Full Response"
                        isExpanded={expandedSections[`${key}-answer`]}
                        onToggle={() => toggleSection(`${key}-answer`)}
                      >
                        <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap">
                          {result.raw_answer}
                        </div>
                      </CollapsibleSection>
                      
                      {/* Decomposition */}
                      {result.evaluations.step_a && (
                        <CollapsibleSection
                          title="Structured Decomposition"
                          isExpanded={expandedSections[`${key}-decomp`]}
                          onToggle={() => toggleSection(`${key}-decomp`)}
                        >
                          <JsonViewer data={result.evaluations.step_a} />
                        </CollapsibleSection>
                      )}
                      
                      {/* Bias Detection */}
                      {result.evaluations.step_b && (
                        <CollapsibleSection
                          title={`Detected Biases (${result.evaluations.step_b.detected_biases?.length || 0})`}
                          isExpanded={expandedSections[`${key}-bias`]}
                          onToggle={() => toggleSection(`${key}-bias`)}
                          variant={result.evaluations.step_b.detected_biases?.length > 0 ? 'warning' : 'default'}
                        >
                          <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                              {result.evaluations.step_b.overall_bias_profile_summary}
                            </p>
                            {result.evaluations.step_b.detected_biases?.map((bias, i) => (
                              <div key={i} className="p-3 rounded-lg bg-muted/50 space-y-2">
                                <Badge variant="outline" className="text-xs">
                                  {bias.label}
                                </Badge>
                                <p className="text-sm text-muted-foreground">{bias.explanation}</p>
                                {bias.evidence_quotes?.length > 0 && (
                                  <div className="space-y-1">
                                    {bias.evidence_quotes.map((quote, qi) => (
                                      <blockquote key={qi} className="flex gap-2 text-sm italic text-muted-foreground border-l-2 border-warning pl-3">
                                        <Quote className="w-3 h-3 flex-shrink-0 mt-1" />
                                        {quote}
                                      </blockquote>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </CollapsibleSection>
                      )}
                      
                      {/* Buen Vivir Alignment */}
                      {result.evaluations.step_c && (
                        <CollapsibleSection
                          title="Buen Vivir Alignment"
                          isExpanded={expandedSections[`${key}-bv`]}
                          onToggle={() => toggleSection(`${key}-bv`)}
                        >
                          <div className="space-y-3">
                            <p className="text-sm text-muted-foreground">{result.evaluations.step_c.explanation}</p>
                            <div className="grid md:grid-cols-2 gap-4">
                              <div>
                                <h5 className="text-sm font-medium mb-2 text-success">Alignment Areas</h5>
                                <ul className="space-y-1">
                                  {result.evaluations.step_c.alignment_areas?.map((item, i) => (
                                    <li key={i} className="text-sm text-muted-foreground">• {item}</li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <h5 className="text-sm font-medium mb-2 text-warning">Tensions/Absences</h5>
                                <ul className="space-y-1">
                                  {result.evaluations.step_c.tensions_or_absences?.map((item, i) => (
                                    <li key={i} className="text-sm text-muted-foreground">• {item}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        </CollapsibleSection>
                      )}
                    </>
                  )}
                </TabsContent>
              );
            })}
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}

interface CollapsibleSectionProps {
  title: string;
  isExpanded?: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  variant?: 'default' | 'warning';
}

function CollapsibleSection({ title, isExpanded = false, onToggle, children, variant = 'default' }: CollapsibleSectionProps) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className={cn(
          "w-full px-4 py-3 flex items-center justify-between text-left transition-colors",
          "hover:bg-muted/50",
          variant === 'warning' && "bg-warning/5"
        )}
      >
        <span className="font-medium text-sm">{title}</span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {isExpanded && (
        <div className="px-4 py-3 border-t border-border animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
}

interface CollapsibleSectionProps {
  title: string;
  isExpanded?: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  variant?: 'default' | 'warning';
}

function CollapsibleSection({ title, isExpanded = false, onToggle, children, variant = 'default' }: CollapsibleSectionProps) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className={cn(
          "w-full px-4 py-3 flex items-center justify-between text-left transition-colors",
          "hover:bg-muted/50",
          variant === 'warning' && "bg-warning/5"
        )}
      >
        <span className="font-medium text-sm">{title}</span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {isExpanded && (
        <div className="px-4 py-3 border-t border-border animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
}
