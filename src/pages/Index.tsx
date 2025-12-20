import { HeroSection } from '@/components/sections/HeroSection';
import { QuestionsSection } from '@/components/sections/QuestionsSection';
import { CommonGroundSection } from '@/components/sections/CommonGroundSection';
import { DivergencesSection } from '@/components/sections/DivergencesSection';
import { ModelDeepDiveSection } from '@/components/sections/ModelDeepDiveSection';
import { ClosingSection } from '@/components/sections/ClosingSection';

const Index = () => {
  return (
    <main className="min-h-screen">
      <HeroSection />
      <QuestionsSection />
      <CommonGroundSection />
      <DivergencesSection />
      <ModelDeepDiveSection />
      <ClosingSection />
    </main>
  );
};

export default Index;
