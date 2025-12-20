import { useEffect, useRef } from 'react';

export const HeroSection = () => {
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
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{ background: 'var(--gradient-hero)' }}
    >
      {/* Decorative organic shapes */}
      <div className="organic-blob w-96 h-96 -top-48 -right-48" />
      <div className="organic-blob w-80 h-80 -bottom-40 -left-40" style={{ animationDelay: '2s' }} />
      
      <div className="section-container text-center relative z-10">
        {/* Title */}
        <h1 className="animate-on-scroll text-display-sm md:text-display font-serif text-foreground mb-8">
          AI Human Wellness Benchmark
        </h1>
        
        {/* Subtitle */}
        <p className="animate-on-scroll text-subtitle md:text-title font-serif text-muted-foreground mb-12 max-w-3xl mx-auto" style={{ transitionDelay: '0.1s' }}>
          How language models understand the conditions for humans — and the planet — to live well enough.
        </p>
        
        {/* Framing paragraph */}
        <div className="animate-on-scroll max-w-2xl mx-auto" style={{ transitionDelay: '0.2s' }}>
          <p className="text-body-lg text-muted-foreground leading-relaxed">
            This benchmark explores how different AI models diagnose threats to human and planetary well-being, 
            where they assign responsibility, and what kinds of futures they imagine.
          </p>
          <p className="text-body-lg text-muted-foreground leading-relaxed mt-6">
            It is grounded in <span className="text-foreground font-medium">Buen Vivir</span> — the idea that 
            living well means collective flourishing within limits, not endless growth.
          </p>
        </div>

        {/* Scroll indicator */}
        <div className="animate-on-scroll mt-20" style={{ transitionDelay: '0.4s' }}>
          <div className="flex flex-col items-center gap-2 text-muted-foreground/60">
            <span className="text-sm tracking-wide uppercase">Scroll to explore</span>
            <svg 
              className="w-5 h-5 animate-bounce" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>
      </div>

      {/* Subtle texture overlay */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
    </section>
  );
};
