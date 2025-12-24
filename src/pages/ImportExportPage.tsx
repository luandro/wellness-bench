import { useState, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import {
  ConfigBundleSchema,
  ResultsBundleSchema,
  QuestionsConfigSchema,
  EvalPromptsConfigSchema,
  ProvidersConfigSchema,
} from '@/lib/schemas';
import { ZodError } from 'zod';
import {
  Download,
  Upload,
  FileJson,
  FolderOpen,
  Package,
  BarChart3,
  Settings,
  Check,
  Loader2,
  FileText
} from 'lucide-react';

export default function ImportExportPage() {
  const { 
    questions, setQuestions, 
    evalPrompts, setEvalPrompts, 
    providers, setProviders,
    runs, syntheses, loadResultsBundle
  } = useApp();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importType, setImportType] = useState<'config' | 'results' | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState<'config' | 'results' | 'csv' | null>(null);

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadJson = (data: object, filename: string) => {
    downloadFile(JSON.stringify(data, null, 2), filename, 'application/json');
  };

  const exportConfigBundle = () => {
    setIsExporting('config');
    try {
      const bundle = {
        questions,
        eval_prompts: evalPrompts,
        providers: {
          ...providers,
          providers: providers.providers.map(p => ({
            ...p,
            // Never include any key information in exports
          })),
        },
        exported_at: new Date().toISOString(),
      };

      downloadJson(bundle, 'benchmark-config-bundle.json');
      toast({
        title: "Config Exported",
        description: "Configuration bundle downloaded successfully.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export config bundle.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(null);
    }
  };

  const exportResultsCSV = () => {
    const completedRuns = runs.filter(r => r.status === 'completed');
    
    if (completedRuns.length === 0) {
      toast({
        title: "No Results",
        description: "There are no completed runs to export.",
        variant: "destructive",
      });
      return;
    }

    setIsExporting('csv');
    try {
      const headers = [
        'Run ID',
        'Run Name',
        'Date',
        'Question ID',
        'Provider',
        'Model',
        'Wellbeing Definition',
        'Main Problems',
        'Alignment Score (0-5)',
        'Coherence Score (0-5)',
        'Humility Score (0-5)',
        'Detected Biases',
        'Raw Answer'
      ];

      const rows = completedRuns.flatMap(run =>
        run.items.map(item => {
          if (!item.result) return null;

          const provider = providers.providers.find(p => p.provider_id === item.provider_id);

          // Safely extract values with null checks for all step outputs
          const wellbeingDef = item.result.step_a?.wellbeing_definition || '';
          const mainProblems = item.result.step_a?.main_problems || [];
          const alignmentScore = item.result.step_c?.alignment_score_0_5 ?? 'N/A';
          const coherenceScore = item.result.step_d?.coherence_score_0_5 ?? 'N/A';
          const humilityScore = item.result.step_e?.humility_score_0_5 ?? 'N/A';
          const detectedBiases = item.result.step_b?.detected_biases || [];

          return [
            run.id,
            run.name,
            new Date(run.created_at).toLocaleDateString(),
            item.question_id,
            provider?.display_name || item.provider_id,
            item.model_id,
            `"${wellbeingDef.replace(/"/g, '""')}"`,
            `"${mainProblems.join('; ').replace(/"/g, '""')}"`,
            alignmentScore,
            coherenceScore,
            humilityScore,
            `"${detectedBiases.map(b => b.label).join('; ').replace(/"/g, '""')}"`,
            `"${(item.result.raw_answer || '').replace(/"/g, '""')}"`
          ].join(',');
        })
      ).filter(Boolean);

      const csvContent = [headers.join(','), ...rows].join('\n');
      
      downloadFile(csvContent, 'benchmark-results.csv', 'text/csv');
      
      toast({
        title: "CSV Exported",
        description: `Exported ${rows.length} result rows.`,
      });
    } catch (error) {
       toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export results CSV.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(null);
    }
  };

  const exportResultsBundle = () => {
    const completedRuns = runs.filter(r => r.status === 'completed');
    
    if (completedRuns.length === 0) {
      toast({
        title: "No Results",
        description: "There are no completed runs to export.",
        variant: "destructive",
      });
      return;
    }

    setIsExporting('results');
    try {
      const catalog = {
        version: "1.0.0",
        generated_at: new Date().toISOString(),
        runs: completedRuns.map(r => ({
          id: r.id,
          name: r.name,
          created_at: r.created_at,
          question_count: new Set(r.items.map(i => i.question_id)).size,
          provider_count: new Set(r.items.map(i => i.provider_id)).size,
        })),
        questions: questions.questions,
        providers: providers.providers.map(p => ({ id: p.provider_id, name: p.display_name })),
      };

      const bundle = {
        catalog,
        runs: completedRuns,
        syntheses,
      };

      downloadJson(bundle, 'benchmark-results-bundle.json');
      toast({
        title: "Results Exported",
        description: `Exported ${completedRuns.length} runs with ${syntheses.length} syntheses.`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export results bundle.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(null);
    }
  };

  const handleImport = (type: 'config' | 'results') => {
    if (isImporting || isExporting) return;
    setImportType(type);
    fileInputRef.current?.click();
  };

  const formatZodError = (error: ZodError): string => {
    const issues = error.issues.slice(0, 3);
    const messages = issues.map(issue => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    });
    if (error.issues.length > 3) {
      messages.push(`...and ${error.issues.length - 3} more issues`);
    }
    return messages.join('; ');
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setImportType(null);
      return;
    }

    setIsImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (importType === 'config') {
        // Validate config bundle structure
        const validatedBundle = ConfigBundleSchema.parse(data);

        // Validate and set each config section
        if (validatedBundle.questions) {
          const validatedQuestions = QuestionsConfigSchema.parse(validatedBundle.questions);
          setQuestions(validatedQuestions);
        }
        if (validatedBundle.eval_prompts) {
          const validatedEvalPrompts = EvalPromptsConfigSchema.parse(validatedBundle.eval_prompts);
          setEvalPrompts(validatedEvalPrompts);
        }
        if (validatedBundle.providers) {
          const validatedProviders = ProvidersConfigSchema.parse(validatedBundle.providers);
          setProviders(validatedProviders);
        }

        toast({
          title: "Config Imported",
          description: "Configuration has been validated and updated.",
        });
      } else if (importType === 'results') {
        // Validate results bundle
        const validatedResults = ResultsBundleSchema.parse(data);
        loadResultsBundle(validatedResults);
        toast({
          title: "Results Imported",
          description: `Loaded ${validatedResults.runs.length} validated runs.`,
        });
      }
    } catch (e) {
      let errorMessage = "Failed to parse file";
      if (e instanceof ZodError) {
        errorMessage = `Validation failed: ${formatZodError(e)}`;
      } else if (e instanceof SyntaxError) {
        errorMessage = "Invalid JSON format";
      } else if (e instanceof Error) {
        errorMessage = e.message;
      }
      toast({
        title: "Import Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      // Reset
      event.target.value = '';
      setImportType(null);
      setIsImporting(false);
    }
  };


  const completedRunsCount = runs.filter(r => r.status === 'completed').length;
  const isBusy = isImporting || isExporting !== null;

  return (
    <MainLayout>
      <div className="p-8 max-w-4xl mx-auto">
        <PageHeader
          title="Import / Export"
          description="Manage configuration and results bundles for backup and sharing."
        />

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="grid gap-6 md:grid-cols-2">
          {/* Export Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-medium flex items-center gap-2">
              <Download className="w-5 h-5 text-primary" />
              Export
            </h2>

            <Card className="card-interactive">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Settings className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Config Bundle</CardTitle>
                    <CardDescription>Questions, evaluation prompts, and providers</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge variant="secondary">
                    {questions.questions.length} questions
                  </Badge>
                  <Badge variant="secondary">
                    {evalPrompts.steps.length} eval steps
                  </Badge>
                  <Badge variant="secondary">
                    {providers.providers.length} providers
                  </Badge>
                </div>
                <Button onClick={exportConfigBundle} className="w-full" disabled={isBusy}>
                  {isExporting === 'config' ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Package className="w-4 h-4 mr-2" />
                  )}
                  {isExporting === 'config' ? 'Exporting...' : 'Export Config Bundle'}
                </Button>
              </CardContent>
            </Card>

            <Card className="card-interactive">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Results Bundle</CardTitle>
                    <CardDescription>Completed runs and synthesis summaries</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge variant="secondary">
                    {completedRunsCount} completed runs
                  </Badge>
                  <Badge variant="secondary">
                    {syntheses.length} syntheses
                  </Badge>
                </div>
                <Button
                  onClick={exportResultsBundle}
                  className="w-full"
                  disabled={isBusy || completedRunsCount === 0}
                >
                  {isExporting === 'results' ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Package className="w-4 h-4 mr-2" />
                  )}
                  {isExporting === 'results' ? 'Exporting...' : 'Export Results Bundle'}
                </Button>
              </CardContent>
            </Card>

            <Card className="card-interactive">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Results CSV</CardTitle>
                    <CardDescription>Flattened results for spreadsheet analysis</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge variant="secondary">
                    {completedRunsCount} completed runs
                  </Badge>
                </div>
                <Button
                  onClick={exportResultsCSV}
                  className="w-full"
                  variant="outline"
                  disabled={isBusy || completedRunsCount === 0}
                >
                  {isExporting === 'csv' ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4 mr-2" />
                  )}
                  {isExporting === 'csv' ? 'Exporting...' : 'Export Results CSV'}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Import Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-medium flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              Import
            </h2>

            <Card className="card-interactive">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <FileJson className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Import Config</CardTitle>
                    <CardDescription>Load questions, prompts, and providers</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  onClick={() => handleImport('config')}
                  className="w-full"
                  disabled={isBusy}
                >
                  {isImporting && importType === 'config' ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <FolderOpen className="w-4 h-4 mr-2" />
                  )}
                  {isImporting && importType === 'config' ? 'Importing...' : 'Select Config File'}
                </Button>
              </CardContent>
            </Card>

            <Card className="card-interactive">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Import Results</CardTitle>
                    <CardDescription>Load runs and syntheses for viewing</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  onClick={() => handleImport('results')}
                  className="w-full"
                  disabled={isBusy}
                >
                  {isImporting && importType === 'results' ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <FolderOpen className="w-4 h-4 mr-2" />
                  )}
                  {isImporting && importType === 'results' ? 'Importing...' : 'Select Results File'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Info Box */}
        <Card className="mt-8 border-primary/20 bg-primary/5">
          <CardContent className="p-5">
            <div className="flex gap-4">
              <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">About Export Bundles</p>
                <ul className="space-y-1">
                  <li>• <strong>Config bundles</strong> contain questions, evaluation prompts, and provider settings (no API keys)</li>
                  <li>• <strong>Results bundles</strong> contain completed runs with all evaluation data</li>
                  <li>• Results bundles can be used in Viewer mode for static hosting</li>
                  <li>• All exports are in JSON format for easy inspection and version control</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
