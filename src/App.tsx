import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "@/contexts/AppContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import BenchmarkPage from "./pages/BenchmarkPage";
import EvaluationPage from "./pages/EvaluationPage";
import ProvidersPage from "./pages/ProvidersPage";
import RunPage from "./pages/RunPage";
import ResultsPage from "./pages/ResultsPage";
import ApiKeysPage from "./pages/ApiKeysPage";
import ImportExportPage from "./pages/ImportExportPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

/**
 * App uses HashRouter for GitHub Pages compatibility.
 * Routes work correctly when hosted on:
 * - GitHub Pages (https://<user>.github.io/<repo>/)
 * - Custom domains (https://example.com/)
 */
const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppProvider>
      <TooltipProvider>
        <ErrorBoundary>
          <Toaster />
          <Sonner />
          <HashRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/benchmark" element={<BenchmarkPage />} />
              <Route path="/evaluation" element={<EvaluationPage />} />
              <Route path="/providers" element={<ProvidersPage />} />
              <Route path="/run" element={<RunPage />} />
              <Route path="/results" element={<ResultsPage />} />
              <Route path="/api-keys" element={<ApiKeysPage />} />
              <Route path="/import-export" element={<ImportExportPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </HashRouter>
        </ErrorBoundary>
      </TooltipProvider>
    </AppProvider>
  </QueryClientProvider>
);

export default App;
