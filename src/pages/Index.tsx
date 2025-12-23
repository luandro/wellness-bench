import { HeroSection } from '@/components/sections/HeroSection';
import { QuestionsSection } from '@/components/sections/QuestionsSection';
import { CommonGroundSection } from '@/components/sections/CommonGroundSection';
import { DivergencesSection } from '@/components/sections/DivergencesSection';
import { ModelDeepDiveSection } from '@/components/sections/ModelDeepDiveSection';
import { MethodologySection } from '@/components/sections/MethodologySection';
import { ClosingSection } from '@/components/sections/ClosingSection';
import { BenchmarkProvider } from '@/contexts/BenchmarkContext';
import { RunTimeline, RunContextHeader } from '@/components/timeline/RunTimeline';
import { BiasToggleGroup } from '@/components/ui/bias-toggle';
import { AdminAccessButton } from '@/components/layout/AdminAccessButton';

const Index = () => {
  return (
    <BenchmarkProvider>
      <AdminAccessButton />
      <main className="min-h-screen">
        <HeroSection />
        
        {/* Run selector and context - appears after hero */}
        <section className="section-container py-8">
          <div className="space-y-6">
            {/* Timeline */}
            <div className="animate-on-scroll">
              <p className="text-center text-xs uppercase tracking-wider text-muted-foreground mb-4">
                Select a benchmark run
              </p>
              <RunTimeline />
            </div>
            
            {/* Context header */}
            <div className="animate-on-scroll">
              <RunContextHeader />
            </div>
            
            {/* Bias filters */}
            <div className="animate-on-scroll flex justify-center">
              <BiasToggleGroup />
            </div>
          </div>
        </section>
        
        <QuestionsSection />
        <CommonGroundSection />
        <DivergencesSection />
        <ModelDeepDiveSection />
        <MethodologySection />
        <ClosingSection />
      </main>
    </BenchmarkProvider>
  );
};

export default Index;
