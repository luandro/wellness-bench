import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProviderBadge } from '@/components/ui/provider-badge';
import { ScoreBadge } from '@/components/ui/score-badge';
import { useApp } from '@/contexts/AppContext';
import { MessageSquare, Boxes, BarChart3, AlertTriangle } from 'lucide-react';

export function ResultsOverview() {
  const { runs, questions, providers } = useApp();

  const completedRuns = runs.filter(r => r.status === 'completed');
  const latestRun = completedRuns[completedRuns.length - 1];

  const stats = {
    totalRuns: completedRuns.length,
    questionsEvaluated: questions.questions.filter(q => q.enabled).length,
    providersActive: providers.providers.filter(p => p.enabled).length,
    totalEvaluations: completedRuns.reduce((acc, run) => 
      acc + run.items.filter(i => i.status === 'succeeded').length, 0
    ),
  };

  if (completedRuns.length === 0) {
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
      {latestRun && (
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-lg">Latest Run: {latestRun.name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {new Date(latestRun.created_at).toLocaleDateString()} at{' '}
              {new Date(latestRun.created_at).toLocaleTimeString()}
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {latestRun.items
                .filter(item => item.status === 'succeeded')
                .slice(0, 5)
                .map((item) => (
                  <ProviderBadge key={item.id} provider={item.provider_id} />
                ))}
              {latestRun.items.filter(i => i.status === 'succeeded').length > 5 && (
                <span className="text-sm text-muted-foreground">
                  +{latestRun.items.filter(i => i.status === 'succeeded').length - 5} more
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
