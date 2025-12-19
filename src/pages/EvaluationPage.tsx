import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { JsonViewer } from '@/components/ui/json-viewer';
import { useApp } from '@/contexts/AppContext';
import { Edit2, Check, X, AlertTriangle, FileCode2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function EvaluationPage() {
  const { evalPrompts, setEvalPrompts } = useApp();
  const [editingStep, setEditingStep] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleEditStep = (stepId: string, currentValue: string) => {
    setEditingStep(stepId);
    setEditValue(currentValue);
  };

  const handleSaveStep = (stepId: string) => {
    setEvalPrompts({
      ...evalPrompts,
      steps: evalPrompts.steps.map(step =>
        step.id === stepId ? { ...step, prompt_template: editValue } : step
      ),
    });
    setEditingStep(null);
  };

  const handleCancelEdit = () => {
    setEditingStep(null);
    setEditValue('');
  };

  return (
    <MainLayout>
      <div className="p-8 max-w-5xl mx-auto">
        <PageHeader
          title="Evaluation Pipeline"
          description="Configure the prompts and rubrics used to evaluate model responses."
        />

        <Tabs defaultValue="steps" className="space-y-6">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="steps" className="data-[state=active]:bg-background">
              Evaluation Steps
            </TabsTrigger>
            <TabsTrigger value="prompts" className="data-[state=active]:bg-background">
              Wrapper Prompts
            </TabsTrigger>
            <TabsTrigger value="biases" className="data-[state=active]:bg-background">
              Bias Taxonomy
            </TabsTrigger>
          </TabsList>

          {/* Evaluation Steps */}
          <TabsContent value="steps" className="space-y-4">
            {evalPrompts.steps.map((step, index) => (
              <Card key={step.id} className="card-elevated">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="font-mono text-xs">
                          Step {String.fromCharCode(65 + index)}
                        </Badge>
                        <CardTitle className="text-base">{step.name}</CardTitle>
                      </div>
                      <CardDescription>{step.description}</CardDescription>
                    </div>
                    {editingStep !== step.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditStep(step.id, step.prompt_template)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Prompt Template */}
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <FileCode2 className="w-4 h-4 text-muted-foreground" />
                      Prompt Template
                    </h4>
                    {editingStep === step.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          rows={10}
                          className="font-mono text-sm"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleSaveStep(step.id)}>
                            <Check className="w-4 h-4 mr-1" />
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                            <X className="w-4 h-4 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <pre className="p-3 rounded-lg bg-muted/50 text-sm font-mono whitespace-pre-wrap overflow-x-auto max-h-40 scrollbar-thin">
                        {step.prompt_template}
                      </pre>
                    )}
                  </div>

                  {/* Output Schema */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">Output Schema</h4>
                    <JsonViewer data={step.output_schema} defaultExpanded={false} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Wrapper Prompts */}
          <TabsContent value="prompts" className="space-y-4">
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="text-base">Answer Wrapper Prompt</CardTitle>
                <CardDescription>
                  The system prompt used when asking models the benchmark questions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="p-4 rounded-lg bg-muted/50 text-sm font-mono whitespace-pre-wrap">
                  {evalPrompts.answer_wrapper_prompt}
                </pre>
              </CardContent>
            </Card>

            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="text-base">Synthesis Prompt</CardTitle>
                <CardDescription>
                  Used to generate cross-model synthesis summaries
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="p-4 rounded-lg bg-muted/50 text-sm font-mono whitespace-pre-wrap">
                  {evalPrompts.synthesis_prompt}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bias Taxonomy */}
          <TabsContent value="biases" className="space-y-4">
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  Bias Taxonomy
                </CardTitle>
                <CardDescription>
                  The taxonomy of biases detected in model responses
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {evalPrompts.bias_taxonomy.map((bias) => (
                    <div
                      key={bias.id}
                      className="p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="text-xs font-mono">
                          {bias.id}
                        </Badge>
                      </div>
                      <h4 className="font-medium text-sm mb-1">{bias.label}</h4>
                      <p className="text-xs text-muted-foreground">{bias.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="mt-6 text-sm text-muted-foreground text-right">
          Version {evalPrompts.version}
        </div>
      </div>
    </MainLayout>
  );
}
