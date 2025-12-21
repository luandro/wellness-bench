import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ProviderBadge } from '@/components/ui/provider-badge';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { Key, Eye, EyeOff, Trash2, Plus, AlertTriangle, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ApiKeysPage() {
  const { providers, storedKeys, setApiKey, removeApiKey, hasEnvKeys, mode } = useApp();
  const { toast } = useToast();
  
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // This page should not be shown if env keys exist or in viewer mode
  if (hasEnvKeys || mode === 'viewer') {
    return (
      <MainLayout>
        <div className="p-8 max-w-4xl mx-auto">
          <PageHeader
            title="API Keys"
            description="API key management is not available."
          />
          <Card className="card-elevated">
            <CardContent className="py-8 text-center">
              <Key className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {hasEnvKeys 
                  ? "API keys are configured via environment variables." 
                  : "API keys are not available in Viewer mode."}
              </p>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const handleSaveKey = async (providerId: string) => {
    if (!keyInput.trim()) {
      toast({
        title: "Invalid Key",
        description: "Please enter a valid API key.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      await setApiKey(providerId, keyInput);
      setEditingProvider(null);
      setKeyInput('');
      setShowKey(false);

      toast({
        title: "API Key Saved",
        description: "Key has been encrypted and stored in browser storage.",
      });
    } catch (error) {
      toast({
        title: "Error Saving Key",
        description: "Failed to encrypt and save the API key.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveKey = (providerId: string) => {
    removeApiKey(providerId);
    toast({
      title: "API Key Removed",
      description: "Key has been removed from browser storage.",
    });
  };

  const getStoredKey = (providerId: string) => {
    return storedKeys.find(k => k.provider_id === providerId);
  };

  return (
    <MainLayout>
      <div className="p-8 max-w-4xl mx-auto">
        <PageHeader
          title="API Keys & Providers"
          description="Configure API keys for LLM providers. Keys are stored locally in your browser."
        />

        {/* Security Warning */}
        <Card className="mb-6 border-warning/30 bg-warning/5">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-foreground mb-1">Security Notice</p>
                <p className="text-muted-foreground">
                  API keys stored in browser storage can be exposed through browser extensions or XSS attacks. 
                  Use limited-scope keys when possible. For production use, configure keys via environment variables.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Provider Keys */}
        <div className="space-y-4">
          {providers.providers.map((provider) => {
            const storedKey = getStoredKey(provider.provider_id);
            const isEditing = editingProvider === provider.provider_id;

            return (
              <Card key={provider.provider_id} className="card-elevated">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ProviderBadge provider={provider.provider_id} />
                      <div>
                        <CardTitle className="text-base">{provider.display_name}</CardTitle>
                        <CardDescription className="font-mono text-xs">
                          {provider.env_key_name}
                        </CardDescription>
                      </div>
                    </div>
                    {storedKey && !isEditing && (
                      <Badge variant="outline" className="text-success border-success/30 bg-success/10">
                        <Check className="w-3 h-3 mr-1" />
                        ****{storedKey.key_last4}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent>
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="relative">
                        <Input
                          type={showKey ? 'text' : 'password'}
                          value={keyInput}
                          onChange={(e) => setKeyInput(e.target.value)}
                          placeholder={`Enter ${provider.display_name} API key...`}
                          className="pr-10 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey(!showKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSaveKey(provider.provider_id)}
                          disabled={isSaving}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          {isSaving ? 'Encrypting...' : 'Save'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingProvider(null);
                            setKeyInput('');
                            setShowKey(false);
                          }}
                          disabled={isSaving}
                        >
                          <X className="w-4 h-4 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : storedKey ? (
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setEditingProvider(provider.provider_id)}
                      >
                        <Key className="w-4 h-4 mr-1" />
                        Update Key
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleRemoveKey(provider.provider_id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      size="sm"
                      onClick={() => setEditingProvider(provider.provider_id)}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add API Key
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Base URL Info */}
        <Card className="mt-6 border-border/50">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> Custom base URLs can be configured on the Providers page. 
              This is useful for using proxies or alternative API endpoints.
            </p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
