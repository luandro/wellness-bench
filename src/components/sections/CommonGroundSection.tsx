import { useEffect, useRef, useState, useMemo } from 'react';
import { Circle, Loader2 } from 'lucide-react';
import { RandomUnderline } from '../ui/random-underline';
import { useBenchmark } from '@/contexts/BenchmarkContext';
import { fetchResults } from '@/lib/basePath';
import type { PerQuestionResult } from '@/types/benchmark';

interface ThemeCluster {
  theme: string;
  points: string[];
}

export const CommonGroundSection = () => {
  const { runDetails } = useBenchmark();
  const [questionResults, setQuestionResults] = useState<Record<string, PerQuestionResult>>({});
  const [isLoading, setIsLoading] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const loadAllSyntheses = async () => {
      if (!runDetails) return;
      
      setIsLoading(true);
      try {
        const results: Record<string, PerQuestionResult> = {};
        for (const qId of runDetails.question_ids) {
          const path = runDetails.file_map.per_question[qId];
          if (path) {
            const data = await fetchResults<PerQuestionResult>(`${runDetails.run_id}/${path}`);
            results[qId] = data;
          }
        }
        setQuestionResults(results);
      } catch (err) {
        console.error('Failed to load syntheses for common ground:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadAllSyntheses();
  }, [runDetails]);

  // Aggregate common ground points from all questions
  const commonGroundData: ThemeCluster[] = useMemo(() => {
    const themes: Record<string, string[]> = {};
    
    Object.values(questionResults).forEach(res => {
      const synthesis = res.synthesis['en'] || Object.values(res.synthesis)[0];
      if (synthesis && synthesis.common_ground) {
        // Group by question title as theme
        themes[res.question.title] = synthesis.common_ground;
      }
    });

    return Object.entries(themes).map(([theme, points]) => ({
      theme,
      points,
    })).filter(cluster => cluster.points.length > 0);
  }, [questionResults]);

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

  if (!runDetails || (commonGroundData.length === 0 && !isLoading)) return null;

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

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Synthesizing consensus...</p>
          </div>
        ) : (
          /* Theme clusters */
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
        )}

        {/* Meta note */}
        {!isLoading && (
          <p className="animate-on-scroll text-center text-sm text-muted-foreground/70 mt-12 italic">
            These shared observations form a baseline — the divergences are where ideology becomes visible.
          </p>
        )}
      </div>
    </section>
  );
};
