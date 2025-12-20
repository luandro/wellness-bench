import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface BiasProfile {
  id: string;
  label: string;
  level: 0 | 1 | 2; // 0 = empty, 1 = half, 2 = filled
}

interface ModelData {
  id: string;
  name: string;
  summary: string;
  biasProfile: BiasProfile[];
  buenVivirAlignment: {
    score: number;
    assessment: string;
  };
  fullAnswer?: string;
  biasAnalysis?: string;
  coherenceNotes?: string;
  epistemicHumility?: string;
}

// Mock data - would come from results
const models: ModelData[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    summary: 'This model emphasizes technological solutions and market mechanisms, while acknowledging systemic challenges. It tends to frame responsibility broadly across stakeholders rather than naming specific power structures.',
    biasProfile: [
      { id: 'market', label: 'Market bias', level: 2 },
      { id: 'growth', label: 'Growth normalization', level: 2 },
      { id: 'techno', label: 'Technosolutionism', level: 2 },
      { id: 'power', label: 'Power invisibility', level: 1 },
    ],
    buenVivirAlignment: {
      score: 2,
      assessment: 'Limited alignment. Acknowledges collective well-being but frames solutions through growth and technology rather than sufficiency and limits.',
    },
    fullAnswer: 'The most important factors undermining long-term human and planetary well-being include climate change, biodiversity loss, and growing inequality. Economic growth, when properly directed through green investments and sustainable technologies, can help address these challenges while improving living standards...',
    biasAnalysis: 'Exhibits strong market default bias, treating market solutions as natural and optimal. Growth is presented as compatible with sustainability without interrogating the fundamental tension.',
    coherenceNotes: 'Solutions are internally consistent but rely on assumptions about technological progress that may not materialize. Trade-offs between growth and limits are acknowledged but not resolved.',
    epistemicHumility: 'Moderate uncertainty acknowledgment. Qualifies predictions but maintains confidence in market-based solutions.',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    summary: 'This model shows stronger awareness of systemic issues and power dynamics. It questions growth assumptions more directly and names specific mechanisms that perpetuate harm.',
    biasProfile: [
      { id: 'market', label: 'Market bias', level: 1 },
      { id: 'growth', label: 'Growth normalization', level: 0 },
      { id: 'techno', label: 'Technosolutionism', level: 1 },
      { id: 'power', label: 'Power invisibility', level: 0 },
    ],
    buenVivirAlignment: {
      score: 4,
      assessment: 'Strong alignment. Emphasizes collective flourishing, questions growth imperatives, and centers planetary limits as a design constraint rather than an obstacle.',
    },
    fullAnswer: 'Long-term well-being is undermined by structural factors that concentrate power and externalize costs. The growth imperative embedded in economic systems creates pressure to convert natural systems into commodities...',
    biasAnalysis: 'Shows awareness of market bias and actively interrogates it. Avoids simple techno-optimism while still acknowledging technology\'s role.',
    coherenceNotes: 'Highly coherent analysis that connects causes and solutions. Acknowledges that proposed changes would face significant political resistance.',
    epistemicHumility: 'High uncertainty acknowledgment. Explicitly names limits of knowledge and the contested nature of values involved.',
  },
  {
    id: 'google',
    name: 'Google',
    summary: 'This model provides comprehensive analysis but tends toward optimism about technological solutions. It balances acknowledgment of systemic issues with confidence in innovation.',
    biasProfile: [
      { id: 'market', label: 'Market bias', level: 1 },
      { id: 'growth', label: 'Growth normalization', level: 2 },
      { id: 'techno', label: 'Technosolutionism', level: 2 },
      { id: 'power', label: 'Power invisibility', level: 1 },
    ],
    buenVivirAlignment: {
      score: 3,
      assessment: 'Partial alignment. Recognizes collective well-being but sees technology and continued development as primary pathways rather than questioning growth itself.',
    },
    fullAnswer: 'Multiple interconnected challenges threaten human and planetary well-being: climate change, resource depletion, inequality, and governance failures. Technological innovation combined with policy reform offers the most promising path forward...',
  },
  {
    id: 'grok',
    name: 'Grok',
    summary: 'This model takes a more provocative stance, questioning assumptions on multiple sides. It shows willingness to name uncomfortable truths but sometimes lacks constructive alternatives.',
    biasProfile: [
      { id: 'market', label: 'Market bias', level: 1 },
      { id: 'growth', label: 'Growth normalization', level: 1 },
      { id: 'techno', label: 'Technosolutionism', level: 1 },
      { id: 'power', label: 'Power invisibility', level: 0 },
    ],
    buenVivirAlignment: {
      score: 3,
      assessment: 'Mixed alignment. Questions conventional wisdom effectively but doesn\'t fully embrace alternative frameworks for well-being.',
    },
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    summary: 'This model provides detailed structural analysis with attention to global inequities and historical patterns. It tends to emphasize collective over individual responsibility.',
    biasProfile: [
      { id: 'market', label: 'Market bias', level: 1 },
      { id: 'growth', label: 'Growth normalization', level: 1 },
      { id: 'techno', label: 'Technosolutionism', level: 1 },
      { id: 'power', label: 'Power invisibility', level: 0 },
    ],
    buenVivirAlignment: {
      score: 4,
      assessment: 'Strong alignment. Centers collective well-being and systemic change, with awareness of global power dynamics and ecological limits.',
    },
  },
];

const ScoreDots = ({ score, max = 5 }: { score: number; max?: number }) => (
  <div className="flex items-center gap-1">
    {Array.from({ length: max }).map((_, i) => (
      <div
        key={i}
        className={cn(
          'score-dot',
          i < score ? 'filled' : 'empty'
        )}
      />
    ))}
    <span className="text-xs text-muted-foreground ml-2">{score}/{max}</span>
  </div>
);

const BiasIndicator = ({ level }: { level: 0 | 1 | 2 }) => (
  <div className="flex items-center gap-0.5">
    {[0, 1].map((i) => (
      <Circle
        key={i}
        className={cn(
          'w-2.5 h-2.5',
          i < level ? 'fill-accent text-accent' : 'text-muted-foreground/30'
        )}
      />
    ))}
  </div>
);

export const ModelDeepDiveSection = () => {
  const [activeModel, setActiveModel] = useState('openai');
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1 }
    );

    const elements = sectionRef.current?.querySelectorAll('.animate-on-scroll');
    elements?.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  const currentModel = models.find((m) => m.id === activeModel)!;

  return (
    <section 
      ref={sectionRef} 
      className="section-wide py-32"
      style={{ background: 'var(--gradient-section)' }}
    >
      <div className="max-w-4xl mx-auto px-6">
        {/* Section header */}
        <div className="animate-on-scroll text-center mb-12">
          <h2 className="text-title font-serif text-foreground mb-4">
            Model Deep Dive
          </h2>
          <p className="text-body-lg text-muted-foreground max-w-2xl mx-auto">
            Explore detailed analysis for each model. Select a provider to see their full response and evaluation.
          </p>
        </div>

        {/* Model tabs */}
        <div className="animate-on-scroll flex flex-wrap justify-center gap-2 mb-12">
          {models.map((model) => (
            <button
              key={model.id}
              onClick={() => setActiveModel(model.id)}
              className={cn(
                'model-tab',
                activeModel === model.id ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              {model.name}
            </button>
          ))}
        </div>

        {/* Model content */}
        <div className="animate-on-scroll bg-card rounded-2xl border border-border/40 p-8 shadow-sm">
          {/* Summary */}
          <div className="mb-8">
            <h3 className="text-lg font-serif font-medium text-foreground mb-3">Summary</h3>
            <p className="text-muted-foreground leading-relaxed">
              {currentModel.summary}
            </p>
          </div>

          {/* Bias profile */}
          <div className="mb-8">
            <h3 className="text-lg font-serif font-medium text-foreground mb-4">Bias Profile</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {currentModel.biasProfile.map((bias) => (
                <div key={bias.id} className="flex flex-col gap-1.5">
                  <span className="text-xs text-muted-foreground">{bias.label}</span>
                  <BiasIndicator level={bias.level} />
                </div>
              ))}
            </div>
          </div>

          {/* Buen Vivir alignment */}
          <div className="mb-8 p-4 rounded-xl bg-secondary/30 border border-border/30">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-foreground">Buen Vivir Alignment</h3>
              <ScoreDots score={currentModel.buenVivirAlignment.score} />
            </div>
            <p className="text-sm text-muted-foreground">
              {currentModel.buenVivirAlignment.assessment}
            </p>
          </div>

          {/* Expandable sections */}
          <Accordion type="single" collapsible className="space-y-2">
            {currentModel.fullAnswer && (
              <AccordionItem value="full-answer" className="border-border/40">
                <AccordionTrigger className="expand-trigger py-3 hover:no-underline">
                  <span className="text-sm font-medium">Full Answer</span>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {currentModel.fullAnswer}
                  </p>
                </AccordionContent>
              </AccordionItem>
            )}

            {currentModel.biasAnalysis && (
              <AccordionItem value="bias-analysis" className="border-border/40">
                <AccordionTrigger className="expand-trigger py-3 hover:no-underline">
                  <span className="text-sm font-medium">Bias Analysis</span>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {currentModel.biasAnalysis}
                  </p>
                </AccordionContent>
              </AccordionItem>
            )}

            {currentModel.coherenceNotes && (
              <AccordionItem value="coherence" className="border-border/40">
                <AccordionTrigger className="expand-trigger py-3 hover:no-underline">
                  <span className="text-sm font-medium">Coherence & Realism</span>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {currentModel.coherenceNotes}
                  </p>
                </AccordionContent>
              </AccordionItem>
            )}

            {currentModel.epistemicHumility && (
              <AccordionItem value="humility" className="border-border/40">
                <AccordionTrigger className="expand-trigger py-3 hover:no-underline">
                  <span className="text-sm font-medium">Epistemic Humility</span>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {currentModel.epistemicHumility}
                  </p>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </div>
      </div>
    </section>
  );
};
