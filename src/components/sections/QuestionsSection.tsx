import { useEffect, useRef, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { RandomUnderline } from '../ui/random-underline';

// Caption metadata for display - maps question titles to descriptive captions
const questionCaptions: Record<string, string> = {
  'Diagnosis': 'What models notice — and what they ignore.',
  'Causality & Responsibility': 'How responsibility is assigned, shifted, or avoided.',
  'Solutions (Living Well Enough)': 'Whether solutions face trade-offs or rely on wishful thinking.',
};

// Default caption for questions without specific caption
const defaultCaption = 'How AI models reason about this dimension of well-being.';

export const QuestionsSection = () => {
  const { questions: questionsConfig } = useApp();
  const sectionRef = useRef<HTMLElement>(null);

  // Questions are static and should always display - use enabled questions from config
  const displayQuestions = useMemo(() => {
    // Safeguard against missing config
    if (!questionsConfig?.questions) {
      console.warn('QuestionsSection: questionsConfig.questions is not available');
      return [];
    }

    // Always show enabled questions from config (static content)
    // runDetails only affects other sections that show benchmark results
    const questionsBase = questionsConfig.questions.filter(q => q.enabled);

    return questionsBase
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((q, index) => ({
        id: q.id,
        number: String(index + 1).padStart(2, '0'),
        title: q.title,
        question: q.text,
        caption: questionCaptions[q.title] || defaultCaption,
      }));
  }, [questionsConfig]);

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
    <section ref={sectionRef} className="section-container">
      {/* Section header */}
      <div className="animate-on-scroll text-center mb-20">
        <h2 className="text-title font-serif text-foreground mb-4">
          <RandomUnderline strokeWidth={4}>The Three Questions</RandomUnderline>
        </h2>
        <p className="text-body-lg text-muted-foreground max-w-2xl mx-auto">
          Each question probes a different aspect of how AI models reason about collective well-being.
        </p>
      </div>

      {displayQuestions.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-2xl border border-dashed border-border/60">
          <p className="text-muted-foreground max-w-sm mx-auto mb-4">
            No questions configured.
          </p>
          <p className="text-sm text-muted-foreground/70 max-w-md mx-auto">
            Questions should be automatically loaded from the configuration. If you're seeing this message, please check the console for errors.
          </p>
        </div>
      ) : (
        /* Question cards */
        <div className="space-y-8">
          {displayQuestions.map((q, index) => (
            <article
              key={q.id}
              className="animate-on-scroll question-card"
              style={{ transitionDelay: `${index * 0.1}s` }}
            >
              {/* Background number watermark */}
              <span className="question-number">{q.number}</span>

              <div className="relative z-10">
                {/* Number and title */}
                <div className="flex items-baseline gap-3 mb-4">
                  <span className="text-sm font-medium text-primary tracking-wider uppercase">
                    {q.number}
                  </span>
                  <span className="text-sm text-muted-foreground">—</span>
                  <span className="text-sm font-medium text-muted-foreground tracking-wider uppercase">
                    {q.title}
                  </span>
                </div>

                {/* Question */}
                <h3 className="text-subtitle font-serif text-foreground mb-4">
                  {q.question}
                </h3>

                {/* Caption */}
                <p className="text-muted-foreground italic">
                  {q.caption}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};