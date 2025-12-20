import { useEffect, useRef } from 'react';

export const ClosingSection = () => {
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
    <section ref={sectionRef} className="section-full min-h-[60vh] flex items-center justify-center">
      <div className="max-w-2xl mx-auto text-center px-6">
        {/* Closing reflection */}
        <blockquote className="animate-on-scroll">
          <p className="text-subtitle md:text-title font-serif text-foreground leading-relaxed mb-8">
            This benchmark does not ask whether AI is intelligent.
          </p>
          <p className="text-subtitle md:text-title font-serif text-muted-foreground leading-relaxed">
            It asks whether AI can imagine futures where humans — and the Earth — live well enough together.
          </p>
        </blockquote>

        {/* Subtle links */}
        <div className="animate-on-scroll mt-16 flex items-center justify-center gap-8" style={{ transitionDelay: '0.2s' }}>
          <a 
            href="#methodology" 
            className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4 decoration-border hover:decoration-foreground"
          >
            About the methodology
          </a>
          <span className="text-border">•</span>
          <a 
            href="#export" 
            className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4 decoration-border hover:decoration-foreground"
          >
            Export data
          </a>
        </div>

        {/* Decorative element */}
        <div className="animate-on-scroll mt-20" style={{ transitionDelay: '0.3s' }}>
          <svg 
            className="w-8 h-8 mx-auto text-muted-foreground/30" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="10" strokeWidth={1} />
            <circle cx="12" cy="12" r="4" strokeWidth={1} />
          </svg>
        </div>
      </div>
    </section>
  );
};
