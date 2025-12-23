import { 
  GitMerge, 
  Search, 
  Scale, 
  BrainCircuit, 
  Eye 
} from 'lucide-react';

const steps = [
  {
    id: 'step-a',
    title: 'Structured Decomposition',
    description: 'We decompose the model\'s answer into structured components for analysis, identifying definitions of well-being, main problems, root causes, and responsibility assignment.',
    icon: GitMerge,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10'
  },
  {
    id: 'step-b',
    title: 'Bias & Assumption Detection',
    description: 'We analyze the response for implicit biases and assumptions, such as market default bias, capitalism normalization, and technosolutionism.',
    icon: Search,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10'
  },
  {
    id: 'step-c',
    title: 'Buen Vivir Alignment',
    description: 'We assess how well the response aligns with Buen Vivir principles: collective well-being, sufficiency, nature as kin, and plural ways of living.',
    icon: Scale,
    color: 'text-green-500',
    bg: 'bg-green-500/10'
  },
  {
    id: 'step-d',
    title: 'Coherence & Realism',
    description: 'We evaluate whether the proposed solutions are internally consistent, acknowledge trade-offs, and offer realistic mechanisms for implementation.',
    icon: BrainCircuit,
    color: 'text-purple-500',
    bg: 'bg-purple-500/10'
  },
  {
    id: 'step-e',
    title: 'Epistemic Humility',
    description: 'We assess the level of epistemic humility, checking if the model acknowledges uncertainty, limitations, and what evidence might change its mind.',
    icon: Eye,
    color: 'text-indigo-500',
    bg: 'bg-indigo-500/10'
  }
];

export const MethodologySection = () => {
  return (
    <section id="methodology" className="section-container bg-muted/30">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight mb-4">Methodology</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Our evaluation pipeline breaks down model responses through a multi-step analytical process to uncover deep structural biases and alignment patterns.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div 
                key={step.id} 
                className={`
                  relative p-6 rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow
                  ${index === steps.length - 1 ? 'md:col-span-2 lg:col-span-1' : ''}
                `}
              >
                <div className={`w-12 h-12 rounded-lg ${step.bg} flex items-center justify-center mb-4`}>
                  <Icon className={`w-6 h-6 ${step.color}`} />
                </div>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
                <div className="absolute top-4 right-4 text-xs font-mono text-muted-foreground/50">
                  Step {String.fromCharCode(65 + index)}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 p-6 rounded-xl border bg-background text-center">
          <p className="text-muted-foreground">
            This automated pipeline allows us to scale analysis across hundreds of responses while maintaining a consistent analytical framework rooted in critical theory and systems thinking.
          </p>
        </div>
      </div>
    </section>
  );
};
