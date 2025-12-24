import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProviderBadge } from '@/components/ui/provider-badge';
import { useApp } from '@/contexts/AppContext';
import { useBenchmark } from '@/contexts/BenchmarkContext';
import { MessageSquare, Boxes, BarChart3, AlertTriangle } from 'lucide-react';

export function ResultsOverview() {
  const { questions, providers } = useApp();
  const { runs, runDetails } = useBenchmark();

  const stats = useMemo(() => {
    if (runDetails && runDetails.stats) {
      return {
        totalRuns: runs.length,
        questionsEvaluated: runDetails.stats.total_questions,
        providersActive: runDetails.models_included.length,
        totalEvaluations: runDetails.stats.succeeded,
      };
    }
    return {
      totalRuns: runs.length,
      questionsEvaluated: questions.questions.filter(q => q.enabled).length,
      providersActive: providers.providers.filter(p => p.enabled).length,
      totalEvaluations: 0,
    };
  }, [runs.length, runDetails, questions.questions, providers.providers]);

  if (!runDetails && runs.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
          <BarChart3 className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">No Results Yet</h3>
        <p className="text-muted-foreground max-w-sm mx-auto">
          Run your first evaluation to see results here. Go to the Run page to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* ... (rest of the cards remain similar but using stats) ... */}
        <Card className="card-elevated">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{stats.totalRuns}</p>
                <p className="text-sm text-muted-foreground">Total Runs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{stats.questionsEvaluated}</p>
                <p className="text-sm text-muted-foreground">Questions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-info/20 flex items-center justify-center">
                <Boxes className="w-5 h-5 text-info" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{stats.providersActive}</p>
                <p className="text-sm text-muted-foreground">Providers</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{stats.totalEvaluations}</p>
                <p className="text-sm text-muted-foreground">Evaluations</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Latest Run Summary */}
      {runDetails && (
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-lg">Run: {runDetails.run_name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {new Date(runDetails.created_at).toLocaleDateString()} at{' '}
              {new Date(runDetails.created_at).toLocaleTimeString()}
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {runDetails.models_included.map((model) => (
                <ProviderBadge key={`${model.provider_id}-${model.model_id}`} provider={model.provider_id} />
              ))}
            </div>
            {runDetails.run_description && (
              <p className="mt-4 text-sm text-muted-foreground">
                {runDetails.run_description}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
