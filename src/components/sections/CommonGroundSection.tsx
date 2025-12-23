import { useEffect, useRef } from 'react';
import { Circle } from 'lucide-react';
import { RandomUnderline } from '../ui/random-underline';

const commonGroundData = [
  {
    theme: 'Climate & Ecology',
    points: [
      'Environmental degradation is a central threat to human well-being',
      'Climate impacts disproportionately affect vulnerable populations',
      'Biodiversity loss undermines ecosystem stability',
    ],
  },
  {
    theme: 'Systemic Inertia',
    points: [
      'Short-term incentives often override long-term planning',
      'Institutional structures resist transformative change',
      'Political cycles discourage multi-generational thinking',
    ],
  },
  {
    theme: 'Inequality & Power',
    points: [
      'Concentrated wealth influences policy outcomes',
      'Global inequities shape vulnerability to crises',
      'Access to resources remains deeply unequal',
    ],
  },
  {
    theme: 'Knowledge & Action Gap',
    points: [
      'Scientific understanding often fails to translate into policy',
      'Collective action problems remain unsolved',
      'Information alone does not drive behavioral change',
    ],
  },
];

export const CommonGroundSection = () => {
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

  return (
    <section 
      ref={sectionRef} 
      className="section-wide py-32"
      style={{ background: 'var(--gradient-section)' }}
    >
      <div className="max-w-4xl mx-auto px-6">
        {/* Section header */}
        <div className="animate-on-scroll text-center mb-16">
          <h2 className="text-title font-serif text-foreground mb-4">
            <RandomUnderline strokeWidth={4}>What most models agree on</RandomUnderline>
          </h2>
          <p className="text-body-lg text-muted-foreground max-w-2xl mx-auto">
            Before exploring differences, here are the themes where AI models show broad consensus.
          </p>
        </div>

        {/* Theme clusters */}
        <div className="grid md:grid-cols-2 gap-8">
          {commonGroundData.map((cluster, index) => (
            <div
              key={cluster.theme}
              className="animate-on-scroll synthesis-card"
              style={{ transitionDelay: `${index * 0.1}s` }}
            >
              <h3 className="text-lg font-serif font-medium text-foreground mb-4 flex items-center gap-2">
                <Circle className="w-2 h-2 fill-primary text-primary" />
                {cluster.theme}
              </h3>
              <ul className="space-y-3">
                {cluster.points.map((point, i) => (
                  <li 
                    key={i} 
                    className="text-muted-foreground text-sm leading-relaxed pl-4 border-l-2 border-border/50"
                  >
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Meta note */}
        <p className="animate-on-scroll text-center text-sm text-muted-foreground/70 mt-12 italic">
          These shared observations form a baseline — the divergences are where ideology becomes visible.
        </p>
      </div>
    </section>
  );
};
