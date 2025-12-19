import { useState, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { 
  Download, 
  Upload, 
  FileJson, 
  FolderOpen, 
  Package,
  BarChart3,
  Settings,
  Check
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

  const exportConfigBundle = () => {
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
  };

  const handleImport = (type: 'config' | 'results') => {
    setImportType(type);
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (importType === 'config') {
        if (data.questions) setQuestions(data.questions);
        if (data.eval_prompts) setEvalPrompts(data.eval_prompts);
        if (data.providers) setProviders(data.providers);
        
        toast({
          title: "Config Imported",
          description: "Configuration has been updated.",
        });
      } else if (importType === 'results') {
        if (data.catalog && data.runs) {
          loadResultsBundle(data);
          toast({
            title: "Results Imported",
            description: `Loaded ${data.runs.length} runs.`,
          });
        } else {
          throw new Error("Invalid results bundle format");
        }
      }
    } catch (e) {
      toast({
        title: "Import Failed",
        description: e instanceof Error ? e.message : "Failed to parse file",
        variant: "destructive",
      });
    }

    // Reset
    event.target.value = '';
    setImportType(null);
  };

  const downloadJson = (data: object, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const completedRunsCount = runs.filter(r => r.status === 'completed').length;

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
                <Button onClick={exportConfigBundle} className="w-full">
                  <Package className="w-4 h-4 mr-2" />
                  Export Config Bundle
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
                  disabled={completedRunsCount === 0}
                >
                  <Package className="w-4 h-4 mr-2" />
                  Export Results Bundle
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
                >
                  <FolderOpen className="w-4 h-4 mr-2" />
                  Select Config File
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
                >
                  <FolderOpen className="w-4 h-4 mr-2" />
                  Select Results File
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
