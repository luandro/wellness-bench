import { useState, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ProviderBadge } from '@/components/ui/provider-badge';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { Play, Square, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Run, RunItem, RunItemStatus, EvaluationResult } from '@/types/benchmark';

export default function RunPage() {
  const { questions, providers, evalPrompts, addRun, updateRun, runs, storedKeys, hasEnvKeys } = useApp();
  const { toast } = useToast();
  
  const [runName, setRunName] = useState(`Run ${new Date().toLocaleDateString()}`);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>(
    questions.questions.filter(q => q.enabled).map(q => q.id)
  );
  const [selectedModels, setSelectedModels] = useState<{providerId: string; modelId: string}[]>(
    providers.providers
      .filter(p => p.enabled)
      .flatMap(p => p.models.filter(m => m.enabled).map(m => ({ providerId: p.provider_id, modelId: m.id })))
  );
  const [isRunning, setIsRunning] = useState(false);
  const [currentRun, setCurrentRun] = useState<Run | null>(null);
  const runItemsRef = useRef<RunItem[]>([]); // Track current items state for updates

  const enabledQuestions = questions.questions.filter(q => q.enabled);
  const enabledProviders = providers.providers.filter(p => p.enabled);

  const hasApiKey = (providerId: string): boolean => {
    if (hasEnvKeys) return true;
    return storedKeys.some(k => k.provider_id === providerId);
  };

  const toggleQuestion = (questionId: string) => {
    setSelectedQuestions(prev =>
      prev.includes(questionId)
        ? prev.filter(id => id !== questionId)
        : [...prev, questionId]
    );
  };

  const toggleModel = (providerId: string, modelId: string) => {
    setSelectedModels(prev => {
      const exists = prev.some(m => m.providerId === providerId && m.modelId === modelId);
      if (exists) {
        return prev.filter(m => !(m.providerId === providerId && m.modelId === modelId));
      }
      return [...prev, { providerId, modelId }];
    });
  };

  const isModelSelected = (providerId: string, modelId: string): boolean => {
    return selectedModels.some(m => m.providerId === providerId && m.modelId === modelId);
  };

  const startRun = async () => {
    if (selectedQuestions.length === 0 || selectedModels.length === 0) {
      toast({
        title: "Selection Required",
        description: "Please select at least one question and one model.",
        variant: "destructive",
      });
      return;
    }

    // Check for missing API keys
    const missingKeys = selectedModels
      .map(m => m.providerId)
      .filter((id, i, arr) => arr.indexOf(id) === i)
      .filter(id => !hasApiKey(id));

    if (missingKeys.length > 0) {
      toast({
        title: "Missing API Keys",
        description: `Please add API keys for: ${missingKeys.join(', ')}`,
        variant: "destructive",
      });
      return;
    }

    const runId = `run-${Date.now()}`;
    const items: RunItem[] = [];

    // Create run items for each question × model combination
    for (const question of selectedQuestions) {
      for (const model of selectedModels) {
        items.push({
          id: `${runId}-${question}-${model.providerId}-${model.modelId}`,
          question_id: question,
          provider_id: model.providerId,
          model_id: model.modelId,
          status: 'queued',
        });
      }
    }

    const run: Run = {
      id: runId,
      name: runName,
      created_at: new Date().toISOString(),
      status: 'running',
      items,
      config_snapshot: {
        questions,
        eval_prompts: evalPrompts,
        providers,
      },
    };

    addRun(run);
    setCurrentRun(run);
    runItemsRef.current = [...items]; // Initialize ref with items
    setIsRunning(true);

    // Simulate running (in real implementation, this would call actual APIs)
    toast({
      title: "Run Started",
      description: `Processing ${items.length} evaluations...`,
    });

    // Simulate progress (demo only)
    for (let i = 0; i < items.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));

      // Use ref to get current state and update it
      runItemsRef.current[i] = {
        ...runItemsRef.current[i],
        status: 'succeeded' as RunItemStatus,
        result: createMockResult(runItemsRef.current[i]),
      };

      const updatedRun = { ...run, items: [...runItemsRef.current] };
      setCurrentRun(updatedRun);
    }

    const completedRun: Run = {
      ...run,
      items: runItemsRef.current,
      status: 'completed',
      completed_at: new Date().toISOString(),
    };
    updateRun(completedRun);
    setCurrentRun(completedRun);
    setIsRunning(false);

    toast({
      title: "Run Completed",
      description: `Successfully processed ${items.length} evaluations.`,
    });
  };

  const stopRun = () => {
    if (currentRun) {
      const stoppedRun = {
        ...currentRun,
        status: 'failed' as const,
      };
      updateRun(stoppedRun);
      setCurrentRun(stoppedRun);
    }
    setIsRunning(false);
  };

  const getProgress = (): number => {
    if (!currentRun) return 0;
    const completed = currentRun.items.filter(i => i.status === 'succeeded' || i.status === 'failed').length;
    return (completed / currentRun.items.length) * 100;
  };

  const getStatusIcon = (status: RunItemStatus) => {
    switch (status) {
      case 'queued':
        return <Clock className="w-4 h-4 text-muted-foreground" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-info animate-spin" />;
      case 'succeeded':
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-destructive" />;
    }
  };

  return (
    <MainLayout>
      <div className="p-8 max-w-5xl mx-auto">
        <PageHeader
          title="Run Evaluation"
          description="Execute benchmark evaluations across selected questions and models."
        />

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Configuration */}
          <div className="space-y-6">
            {/* Run Name */}
            <Card className="card-elevated">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Run Name</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  value={runName}
                  onChange={(e) => setRunName(e.target.value)}
                  placeholder="Enter run name..."
                  disabled={isRunning}
                />
              </CardContent>
            </Card>

            {/* Question Selection */}
            <Card className="card-elevated">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Questions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {enabledQuestions.map((question) => (
                  <label
                    key={question.id}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border border-border/50 cursor-pointer transition-colors",
                      selectedQuestions.includes(question.id) ? "bg-primary/5 border-primary/30" : "hover:bg-muted/50"
                    )}
                  >
                    <Checkbox
                      checked={selectedQuestions.includes(question.id)}
                      onCheckedChange={() => toggleQuestion(question.id)}
                      disabled={isRunning}
                    />
                    <div>
                      <p className="font-medium text-sm">{question.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{question.text}</p>
                    </div>
                  </label>
                ))}
              </CardContent>
            </Card>

            {/* Model Selection */}
            <Card className="card-elevated">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Models</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {enabledProviders.map((provider) => (
                  <div key={provider.provider_id}>
                    <div className="flex items-center gap-2 mb-2">
                      <ProviderBadge provider={provider.provider_id} />
                      {!hasApiKey(provider.provider_id) && (
                        <Badge variant="outline" className="text-warning text-xs">
                          No key
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1 pl-2">
                      {provider.models.filter(m => m.enabled).map((model) => (
                        <label
                          key={model.id}
                          className="flex items-center gap-2 py-1 cursor-pointer"
                        >
                          <Checkbox
                            checked={isModelSelected(provider.provider_id, model.id)}
                            onCheckedChange={() => toggleModel(provider.provider_id, model.id)}
                            disabled={isRunning || !hasApiKey(provider.provider_id)}
                          />
                          <span className="text-sm">{model.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Run Status */}
          <div className="space-y-6">
            {/* Action Card */}
            <Card className="card-elevated">
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <div className="text-4xl font-semibold">
                    {selectedQuestions.length * selectedModels.length}
                  </div>
                  <p className="text-muted-foreground">
                    {selectedQuestions.length} questions × {selectedModels.length} models
                  </p>
                  
                  {isRunning ? (
                    <div className="space-y-4">
                      <Progress value={getProgress()} className="h-2" />
                      <Button onClick={stopRun} variant="destructive" className="w-full">
                        <Square className="w-4 h-4 mr-2" />
                        Stop Run
                      </Button>
                    </div>
                  ) : (
                    <Button onClick={startRun} className="w-full" size="lg">
                      <Play className="w-4 h-4 mr-2" />
                      Start Evaluation
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Run Items Status */}
            {currentRun && (
              <Card className="card-elevated">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {currentRun.items.map((item) => {
                      const question = questions.questions.find(q => q.id === item.question_id);
                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 p-2 rounded-lg bg-muted/30"
                        >
                          {getStatusIcon(item.status)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{question?.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.provider_id} / {item.model_id}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Runs */}
            {runs.length > 0 && !currentRun && (
              <Card className="card-elevated">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Recent Runs</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {runs.slice(-5).reverse().map((run) => (
                      <div
                        key={run.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                      >
                        <div>
                          <p className="text-sm font-medium">{run.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(run.created_at).toLocaleString()}
                          </p>
                        </div>
                        <Badge
                          variant={run.status === 'completed' ? 'default' : 'secondary'}
                        >
                          {run.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

// Mock result generator for demo purposes
function createMockResult(item: RunItem): EvaluationResult {
  return {
    question_id: item.question_id,
    provider_id: item.provider_id,
    model_id: item.model_id,
    raw_answer: "This is a mock response for demonstration purposes. In a real run, this would contain the actual model response about human and planetary well-being.",
    step_a: {
      wellbeing_definition: "Holistic state of physical, mental, and social health",
      main_problems: ["Climate change", "Inequality", "Biodiversity loss"],
      root_causes: ["Unsustainable consumption", "Short-term thinking"],
      responsibility_assignment: {
        groups: ["Governments", "Corporations", "Individuals"],
        narrative: "Shared responsibility with varying degrees of influence"
      },
      time_horizon: "intergenerational",
      mechanisms_of_change: ["Policy reform", "Education", "Technology"],
      treated_as_fixed_or_inevitable: ["Economic growth paradigm"],
      notable_omissions: ["Indigenous knowledge systems"]
    },
    step_b: {
      detected_biases: [
        {
          id: "growth_normalization",
          label: "Growth Normalization",
          evidence_quotes: ["sustained economic development"],
          explanation: "Assumes growth is compatible with sustainability"
        }
      ],
      overall_bias_profile_summary: "Moderate market-oriented assumptions present"
    },
    step_c: {
      alignment_areas: ["Collective well-being mentioned", "Nature connection acknowledged"],
      tensions_or_absences: ["Limited discussion of sufficiency", "Growth still assumed"],
      alignment_score_0_5: 3,
      explanation: "Partial alignment with Buen Vivir principles"
    },
    step_d: {
      coherence_score_0_5: 4,
      tradeoffs_acknowledged: true,
      enforcement_or_coordination_mechanisms_present: false,
      realism_notes: ["Implementation details lacking"],
      explanation: "Logically coherent but light on mechanisms"
    },
    step_e: {
      humility_score_0_5: 3,
      uncertainty_acknowledged: true,
      what_evidence_would_change_mind: ["Long-term data on interventions"],
      evidence_quotes: ["It is difficult to predict..."],
      explanation: "Some epistemic humility demonstrated"
    },
    prompt_inputs: {
      question: "Mock question",
      model_params: { temperature: 0.7, max_tokens: 4096 }
    },
    metadata: {
      timestamp: new Date().toISOString(),
      latency_ms: 1500,
      token_usage: {
        prompt_tokens: 500,
        completion_tokens: 1000,
        total_tokens: 1500
      }
    }
  };
}
