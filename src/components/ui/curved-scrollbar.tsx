import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface CurvedScrollbarProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  borderRadius?: number;
  thumbColor?: string;
  trackColor?: string;
}

export function CurvedScrollbar({ 
  children, 
  className, 
  borderRadius = 32,
  thumbColor = "#FC4847",
  trackColor = "rgba(0,0,0,0.05)",
  ...props 
}: CurvedScrollbarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<SVGPathElement>(null);
  const thumbRef = useRef<SVGPathElement>(null);

  // Configuration constants matching the CodePen
  const OFFSET = 10; 
  const EXTRA_INSET = 20;
  const MIN_START_RATIO = 0.1;
  const MIN_THUMB = 60;
  const SEGMENTS = 100;

  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    const inner = innerRef.current;
    const trackPath = trackRef.current;
    const thumbPath = thumbRef.current;

    if (!container || !content || !inner || !trackPath || !thumbPath) return;

    let pathLength = 0;
    let thumbLength = 50;
    let dragging = false;
    let pointerId: number | null = null;

    const updatePath = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;

      const r = borderRadius; 

      const effectiveRadius = Math.max(r - OFFSET, 0);
      const trackX = w - OFFSET;
      const topY = OFFSET;
      const bottomY = h - OFFSET;
      const cornerX = trackX - effectiveRadius;

      const minStartX = w * MIN_START_RATIO;
      let startX = trackX - effectiveRadius * EXTRA_INSET;
      if (startX < minStartX) startX = minStartX;
      if (startX > cornerX) startX = cornerX;

      const d = `
        M ${startX} ${topY}
        L ${cornerX} ${topY}                     
        A ${effectiveRadius} ${effectiveRadius} 0 0 1 ${trackX} ${topY + effectiveRadius} 
        L ${trackX} ${bottomY - effectiveRadius} 
        A ${effectiveRadius} ${effectiveRadius} 0 0 1 ${cornerX} ${bottomY} 
        L ${startX} ${bottomY}
      `;
      trackPath.setAttribute('d', d);

      pathLength = trackPath.getTotalLength();
      
      const hasOverflow = content.scrollHeight > content.clientHeight;
      if (!hasOverflow || pathLength === 0) {
          trackPath.style.opacity = '0';
          thumbPath.style.opacity = '0';
          thumbPath.style.pointerEvents = 'none';
      } else {
          trackPath.style.opacity = '1';
          thumbPath.style.opacity = '1';
          thumbPath.style.pointerEvents = 'auto';
          
          const ratio = content.clientHeight / content.scrollHeight;
          thumbLength = Math.max(MIN_THUMB, pathLength * ratio);
      }

      updateThumb();
    };

    const updateThumb = () => {
      if (pathLength === 0) return;

      const scrollableHeight = content.scrollHeight - content.clientHeight;
      const scrollRatio = scrollableHeight > 0 ? content.scrollTop / scrollableHeight : 0;
      const startOffset = (pathLength - thumbLength) * scrollRatio;
      const endOffset = startOffset + thumbLength;

      const points = [];
      for (let i = 0; i <= SEGMENTS; i++) {
        const t = startOffset + ((endOffset - startOffset) / SEGMENTS) * i;
        if (t >= 0 && t <= pathLength) {
             try {
                const p = trackPath.getPointAtLength(t);
                points.push(`${p.x} ${p.y}`);
             } catch (e) { /* ignore potential path errors */ }
        }
      }

      if (points.length > 0) {
        const segmentD = `M ${points[0]} ${points.slice(1).map(pt => `L ${pt}`).join(' ')}`;
        thumbPath.setAttribute('d', segmentD);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      dragging = true;
      pointerId = e.pointerId;
      thumbPath.setPointerCapture(pointerId);
      thumbPath.classList.add('grabbing');
      document.body.style.cursor = 'grabbing';
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging || e.pointerId !== pointerId) return;
      const rect = container.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      let ratio = relativeY / rect.height;
      ratio = Math.max(0, Math.min(1, ratio));
      content.scrollTop = ratio * (content.scrollHeight - content.clientHeight);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!dragging || e.pointerId !== pointerId) return;
      dragging = false;
      try { thumbPath.releasePointerCapture(pointerId); } catch {}
      pointerId = null;
      thumbPath.classList.remove('grabbing');
      document.body.style.cursor = '';
    };

    thumbPath.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    content.addEventListener('scroll', updateThumb);
    
    const resizeObserver = new ResizeObserver(() => updatePath());
    resizeObserver.observe(container);
    resizeObserver.observe(inner);

    updatePath();

    return () => {
      thumbPath.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      content.removeEventListener('scroll', updateThumb);
      resizeObserver.disconnect();
    };
  }, [borderRadius, thumbColor, trackColor]); // Added missing dependencies

  return (
    <div 
        ref={containerRef} 
        className={cn("relative overflow-hidden bg-background", className)}
        style={{ borderRadius: `${borderRadius}px` }}
        {...props}
    >
      <div 
        ref={contentRef} 
        className="h-full w-full overflow-y-auto scrollbar-hidden"
        style={{ 
            scrollbarWidth: 'none', 
            msOverflowStyle: 'none',
        }}
      >
        <style>{`
            .scrollbar-hidden::-webkit-scrollbar { display: none !important; }
        `}</style>
        <div ref={innerRef} className="min-h-full">
          {children}
        </div>
      </div>

      <svg 
        className="absolute inset-0 w-full h-full pointer-events-none z-50"
        aria-hidden="true"
      >
        <path 
            ref={trackRef} 
            className="fill-none stroke-[6px] transition-opacity duration-300"
            style={{ stroke: `${thumbColor}15`, opacity: 0 }}
            strokeLinecap="round"
        />
        <path 
            ref={thumbRef} 
            className="fill-none stroke-[6px] transition-all duration-150 cursor-grab pointer-events-auto hover:stroke-[9px]"
            style={{ 
              stroke: thumbColor,
              opacity: 0,
              transition: 'stroke-width 0.15s, stroke 0.15s, opacity 0.3s' 
            }}
            strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
