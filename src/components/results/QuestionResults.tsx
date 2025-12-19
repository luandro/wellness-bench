import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ProviderBadge } from '@/components/ui/provider-badge';
import { ScoreBadge } from '@/components/ui/score-badge';
import { JsonViewer } from '@/components/ui/json-viewer';
import { useApp } from '@/contexts/AppContext';
import type { Question, EvaluationResult } from '@/types/benchmark';
import { ChevronDown, ChevronUp, Quote, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuestionResultsProps {
  question: Question;
}

export function QuestionResults({ question }: QuestionResultsProps) {
  const { runs, syntheses, providers } = useApp();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Get all results for this question from completed runs
  const results: EvaluationResult[] = runs
    .filter(r => r.status === 'completed')
    .flatMap(r => r.items)
    .filter(item => item.question_id === question.id && item.status === 'succeeded' && item.result)
    .map(item => item.result!);

  const synthesis = syntheses.find(s => s.question_id === question.id);

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const activeProviders = providers.providers.filter(p => p.enabled);

  if (results.length === 0) {
    return (
      <Card className="card-elevated">
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">No results available for this question yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Synthesis Summary */}
      {synthesis && (
        <Card className="card-elevated border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary" />
              Synthesis Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {synthesis.common_ground.length > 0 && (
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
            
            {synthesis.key_divergences.length > 0 && (
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
            
            {synthesis.salient_bias_patterns.length > 0 && (
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
        <Tabs defaultValue={activeProviders[0]?.provider_id}>
          <CardHeader>
            <TabsList className="w-full justify-start bg-muted/50 p-1">
              {activeProviders.map((provider) => {
                const hasResults = results.some(r => r.provider_id === provider.provider_id);
                return (
                  <TabsTrigger
                    key={provider.provider_id}
                    value={provider.provider_id}
                    disabled={!hasResults}
                    className={cn(
                      "data-[state=active]:bg-background",
                      !hasResults && "opacity-50"
                    )}
                  >
                    {provider.display_name}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </CardHeader>
          
          <CardContent>
            {activeProviders.map((provider) => {
              const result = results.find(r => r.provider_id === provider.provider_id);
              
              if (!result) {
                return (
                  <TabsContent key={provider.provider_id} value={provider.provider_id}>
                    <p className="text-muted-foreground text-center py-8">
                      No results from {provider.display_name} for this question.
                    </p>
                  </TabsContent>
                );
              }
              
              return (
                <TabsContent key={provider.provider_id} value={provider.provider_id} className="space-y-4">
                  {/* Scores Overview */}
                  <div className="flex flex-wrap gap-4 pb-4 border-b border-border">
                    <ScoreBadge score={result.step_c.alignment_score_0_5} label="Buen Vivir" />
                    <ScoreBadge score={result.step_d.coherence_score_0_5} label="Coherence" />
                    <ScoreBadge score={result.step_e.humility_score_0_5} label="Humility" />
                    <Badge variant={result.step_d.tradeoffs_acknowledged ? "default" : "secondary"}>
                      Trade-offs: {result.step_d.tradeoffs_acknowledged ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  
                  {/* Raw Answer */}
                  <CollapsibleSection
                    title="Full Response"
                    isExpanded={expandedSections[`${provider.provider_id}-answer`]}
                    onToggle={() => toggleSection(`${provider.provider_id}-answer`)}
                  >
                    <div className="prose prose-sm max-w-none text-muted-foreground">
                      {result.raw_answer}
                    </div>
                  </CollapsibleSection>
                  
                  {/* Decomposition */}
                  <CollapsibleSection
                    title="Structured Decomposition"
                    isExpanded={expandedSections[`${provider.provider_id}-decomp`]}
                    onToggle={() => toggleSection(`${provider.provider_id}-decomp`)}
                  >
                    <JsonViewer data={result.step_a} />
                  </CollapsibleSection>
                  
                  {/* Bias Detection */}
                  <CollapsibleSection
                    title={`Detected Biases (${result.step_b.detected_biases.length})`}
                    isExpanded={expandedSections[`${provider.provider_id}-bias`]}
                    onToggle={() => toggleSection(`${provider.provider_id}-bias`)}
                    variant={result.step_b.detected_biases.length > 0 ? 'warning' : 'default'}
                  >
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        {result.step_b.overall_bias_profile_summary}
                      </p>
                      {result.step_b.detected_biases.map((bias, i) => (
                        <div key={i} className="p-3 rounded-lg bg-muted/50 space-y-2">
                          <Badge variant="outline" className="text-xs">
                            {bias.label}
                          </Badge>
                          <p className="text-sm text-muted-foreground">{bias.explanation}</p>
                          {bias.evidence_quotes.length > 0 && (
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
                  
                  {/* Buen Vivir Alignment */}
                  <CollapsibleSection
                    title="Buen Vivir Alignment"
                    isExpanded={expandedSections[`${provider.provider_id}-bv`]}
                    onToggle={() => toggleSection(`${provider.provider_id}-bv`)}
                  >
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">{result.step_c.explanation}</p>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <h5 className="text-sm font-medium mb-2 text-success">Alignment Areas</h5>
                          <ul className="space-y-1">
                            {result.step_c.alignment_areas.map((item, i) => (
                              <li key={i} className="text-sm text-muted-foreground">• {item}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h5 className="text-sm font-medium mb-2 text-warning">Tensions/Absences</h5>
                          <ul className="space-y-1">
                            {result.step_c.tensions_or_absences.map((item, i) => (
                              <li key={i} className="text-sm text-muted-foreground">• {item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </CollapsibleSection>
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
