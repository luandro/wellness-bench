import { useEffect, useRef, useState, useMemo } from 'react';
import { useBenchmark } from '@/contexts/BenchmarkContext';
import { useApp } from '@/contexts/AppContext';
import { fetchResults } from '@/lib/basePath';
import type { PerQuestionResult } from '@/types/benchmark';
import { RandomUnderline } from '../ui/random-underline';
import { Loader2 } from 'lucide-react';

// Caption metadata for display - maps question titles to descriptive captions
const questionCaptions: Record<string, string> = {
  'Diagnosis': 'What models notice — and what they ignore.',
  'Causality & Responsibility': 'How responsibility is assigned, shifted, or avoided.',
  'Solutions (Living Well Enough)': 'Whether solutions face trade-offs or rely on wishful thinking.',
};

// Default caption for questions without specific caption
const defaultCaption = 'How AI models reason about this dimension of well-being.';

export const QuestionsSection = () => {
  const { runDetails } = useBenchmark();
  const { questions: questionsConfig } = useApp();
  const [questionResults, setQuestionResults] = useState<Record<string, PerQuestionResult>>({});
  const [isLoading, setIsLoading] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const loadQuestions = async () => {
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
        console.error('Failed to load questions for section:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadQuestions();
  }, [runDetails]);

  // Use real results if available, otherwise fallback to the base questions config
  const displayQuestions = useMemo(() => {
    const questionsBase = runDetails 
      ? runDetails.question_ids.map(id => questionsConfig.questions.find(q => q.id === id)).filter(Boolean)
      : questionsConfig.questions.filter(q => q.enabled);

    return (questionsBase as any[])
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((q, index) => ({
        id: q.id,
        number: String(index + 1).padStart(2, '0'),
        title: q.title,
        question: q.text,
        caption: questionCaptions[q.title] || defaultCaption,
      }));
  }, [runDetails, questionResults, questionsConfig.questions]);

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

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
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