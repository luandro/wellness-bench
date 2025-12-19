import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ProviderBadge } from '@/components/ui/provider-badge';
import { useApp } from '@/contexts/AppContext';
import { Check, X, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ProvidersPage() {
  const { providers, setProviders, storedKeys, hasEnvKeys, mode } = useApp();

  const handleToggleProvider = (providerId: string) => {
    setProviders({
      ...providers,
      providers: providers.providers.map(p =>
        p.provider_id === providerId ? { ...p, enabled: !p.enabled } : p
      ),
    });
  };

  const handleToggleModel = (providerId: string, modelId: string) => {
    setProviders({
      ...providers,
      providers: providers.providers.map(p =>
        p.provider_id === providerId
          ? {
              ...p,
              models: p.models.map(m =>
                m.id === modelId ? { ...m, enabled: !m.enabled } : m
              ),
            }
          : p
      ),
    });
  };

  const hasApiKey = (providerId: string): boolean => {
    if (hasEnvKeys) return true;
    return storedKeys.some(k => k.provider_id === providerId);
  };

  return (
    <MainLayout>
      <div className="p-8 max-w-5xl mx-auto">
        <PageHeader
          title="Providers & Models"
          description="Configure which AI providers and models to use for evaluation."
        />

        <div className="grid gap-4">
          {providers.providers.map((provider) => {
            const hasKey = hasApiKey(provider.provider_id);
            const enabledModels = provider.models.filter(m => m.enabled).length;

            return (
              <Card
                key={provider.provider_id}
                className={cn(
                  "card-interactive",
                  !provider.enabled && "opacity-60"
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ProviderBadge provider={provider.provider_id} />
                      <div>
                        <CardTitle className="text-base">{provider.display_name}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {enabledModels} of {provider.models.length} models enabled
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {mode === 'builder' && (
                        <div className="flex items-center gap-2">
                          {hasKey ? (
                            <Badge variant="outline" className="text-success border-success/30 bg-success/10">
                              <Check className="w-3 h-3 mr-1" />
                              API Key Set
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-warning border-warning/30 bg-warning/10">
                              <X className="w-3 h-3 mr-1" />
                              No API Key
                            </Badge>
                          )}
                        </div>
                      )}
                      <Switch
                        checked={provider.enabled}
                        onCheckedChange={() => handleToggleProvider(provider.provider_id)}
                      />
                    </div>
                  </div>
                </CardHeader>

                {provider.enabled && (
                  <CardContent className="pt-0">
                    <div className="grid gap-2">
                      {provider.models.map((model) => (
                        <div
                          key={model.id}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg border border-border/50",
                            "transition-colors",
                            model.enabled ? "bg-muted/30" : "bg-background"
                          )}
                        >
                          <div>
                            <span className="font-medium text-sm">{model.name}</span>
                            <p className="text-xs text-muted-foreground font-mono">
                              {model.id}
                            </p>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-xs text-muted-foreground">
                              temp: {model.default_params.temperature} · max: {model.default_params.max_tokens}
                            </div>
                            <Switch
                              checked={model.enabled}
                              onCheckedChange={() => handleToggleModel(provider.provider_id, model.id)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {provider.base_url && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <ExternalLink className="w-3 h-3" />
                          <span className="font-mono">{provider.base_url}</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-6 text-sm text-muted-foreground text-right">
          Version {providers.version}
        </div>
      </div>
    </MainLayout>
  );
}
