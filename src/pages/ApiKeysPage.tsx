import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ProviderBadge } from '@/components/ui/provider-badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { Key, Eye, EyeOff, Trash2, Plus, AlertTriangle, Check, X, Lock, Unlock, ShieldAlert } from 'lucide-react';

export default function ApiKeysPage() {
  const {
    providers,
    storedKeys,
    setApiKey,
    removeApiKey,
    hasEnvKeys,
    mode,
    isVaultSetUp,
    isVaultUnlocked,
    unlockVault,
    lockVault,
    resetVault,
  } = useApp();
  const { toast } = useToast();

  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Vault passphrase state
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

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

  const handleUnlockVault = async () => {
    if (!passphrase) {
      toast({
        title: "Passphrase Required",
        description: "Please enter a passphrase.",
        variant: "destructive",
      });
      return;
    }

    // For first-time setup, require confirmation
    if (!isVaultSetUp) {
      if (passphrase.length < 8) {
        toast({
          title: "Passphrase Too Short",
          description: "Passphrase must be at least 8 characters.",
          variant: "destructive",
        });
        return;
      }

      if (passphrase !== confirmPassphrase) {
        toast({
          title: "Passphrases Don't Match",
          description: "Please make sure both passphrases match.",
          variant: "destructive",
        });
        return;
      }
    }

    setIsUnlocking(true);
    try {
      const success = await unlockVault(passphrase);
      if (success) {
        setPassphrase('');
        setConfirmPassphrase('');
        toast({
          title: isVaultSetUp ? "Vault Unlocked" : "Vault Created",
          description: isVaultSetUp
            ? "You can now manage your API keys."
            : "Your vault has been created. You can now add API keys.",
        });
      }
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleLockVault = () => {
    lockVault();
    setEditingProvider(null);
    setKeyInput('');
    toast({
      title: "Vault Locked",
      description: "Your API keys are now protected.",
    });
  };

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
        description: "Key has been encrypted and stored securely.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to encrypt and save the API key.";
      toast({
        title: "Error Saving Key",
        description: message,
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

  // Render vault unlock/setup UI
  if (!isVaultUnlocked) {
    return (
      <MainLayout>
        <div className="p-8 max-w-4xl mx-auto">
          <PageHeader
            title="API Keys & Providers"
            description="Configure API keys for LLM providers. Keys are protected with a passphrase."
          />

          <Card className="card-elevated max-w-md mx-auto">
            <CardHeader className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-primary" />
              </div>
              <CardTitle>
                {isVaultSetUp ? "Unlock Your Vault" : "Create Your Vault"}
              </CardTitle>
              <CardDescription>
                {isVaultSetUp
                  ? "Enter your passphrase to access your stored API keys."
                  : "Create a passphrase to securely store your API keys. Choose a strong passphrase you'll remember."}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Passphrase</label>
                <div className="relative">
                  <Input
                    type={showPassphrase ? 'text' : 'password'}
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder="Enter your passphrase..."
                    className="pr-10"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && isVaultSetUp) {
                        handleUnlockVault();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassphrase(!showPassphrase)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {!isVaultSetUp && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Confirm Passphrase</label>
                  <Input
                    type={showPassphrase ? 'text' : 'password'}
                    value={confirmPassphrase}
                    onChange={(e) => setConfirmPassphrase(e.target.value)}
                    placeholder="Confirm your passphrase..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleUnlockVault();
                      }
                    }}
                  />
                </div>
              )}

              <Button
                className="w-full"
                onClick={handleUnlockVault}
                disabled={isUnlocking}
              >
                <Unlock className="w-4 h-4 mr-2" />
                {isUnlocking ? 'Processing...' : isVaultSetUp ? 'Unlock Vault' : 'Create Vault'}
              </Button>

              {isVaultSetUp && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" className="w-full text-destructive hover:text-destructive">
                      <ShieldAlert className="w-4 h-4 mr-2" />
                      Forgot Passphrase? Reset Vault
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reset Vault</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete all stored API keys. You cannot undo this action.
                        You will need to re-enter all your API keys after setting a new passphrase.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={resetVault}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Reset Vault
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              <div className="text-xs text-muted-foreground text-center pt-2">
                <p>Your passphrase is never stored. Keep it safe!</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-8 max-w-4xl mx-auto">
        <PageHeader
          title="API Keys & Providers"
          description="Configure API keys for LLM providers. Keys are stored locally in your browser."
        />

        {/* Vault Status & Lock Button */}
        <div className="flex justify-end mb-4">
          <Button variant="outline" size="sm" onClick={handleLockVault}>
            <Lock className="w-4 h-4 mr-2" />
            Lock Vault
          </Button>
        </div>

        {/* Security Warning */}
        <Card className="mb-6 border-warning/30 bg-warning/5">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-foreground mb-1">Security Notice</p>
                <p className="text-muted-foreground">
                  API keys are encrypted with your passphrase before storage.
                  For maximum security, use limited-scope keys and consider environment variables for production.
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
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Remove
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove API Key</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove the API key for {provider.display_name}?
                              You will need to re-enter it to run evaluations with this provider.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRemoveKey(provider.provider_id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
