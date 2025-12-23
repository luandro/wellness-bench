import { useBenchmark } from '@/contexts/BenchmarkContext';
import { cn } from '@/lib/utils';
import { Calendar, ChevronRight } from 'lucide-react';
import { useState, useRef } from 'react';

export function RunTimeline() {
  const { runs, selectedRun, setSelectedRunId } = useBenchmark();
  const [showAll, setShowAll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const visibleRuns = showAll ? runs : runs.slice(0, 4);
  const selectedRunId = selectedRun?.id ?? null;

  return (
    <div className="relative">
      {/* Timeline container */}
      <div 
        ref={containerRef}
        className="flex items-center justify-center gap-3 overflow-x-auto scrollbar-thin py-2"
      >
        {visibleRuns.map((run, index) => {
          const isSelected = selectedRunId === run.id;
          
          return (
            <button
              key={run.id}
              onClick={() => setSelectedRunId(run.id)}
              className={cn(
                'group relative flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl transition-all duration-300',
                'min-w-[100px] shrink-0',
                isSelected 
                  ? 'bg-card shadow-md border border-border/60' 
                  : 'hover:bg-muted/50 border border-transparent'
              )}
            >
              {/* Timeline dot */}
              <div className={cn(
                'w-3 h-3 rounded-full transition-all duration-300',
                isSelected 
                  ? 'bg-primary scale-110' 
                  : 'bg-muted-foreground/30 group-hover:bg-muted-foreground/50'
              )} />
              
              {/* Run name */}
              <span className={cn(
                'text-xs font-medium whitespace-nowrap transition-colors',
                isSelected ? 'text-foreground' : 'text-muted-foreground'
              )}>
                {run.name}
              </span>
              
              {/* Latest badge */}
              {run.isLatest && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary rounded-full">
                  Latest
                </span>
              )}
              
              {/* Connecting line */}
              {index < visibleRuns.length - 1 && (
                <div className="absolute top-[22px] -right-1.5 w-3 h-px bg-border" />
              )}
            </button>
          );
        })}
        
        {/* Show more button */}
        {runs.length > 4 && !showAll && (
          <button
            onClick={() => setShowAll(true)}
            className="flex items-center gap-1 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>+{runs.length - 4} more</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

export function RunContextHeader() {
  const { selectedRun, isLoading } = useBenchmark();

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric',
      year: 'numeric' 
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4 px-6 bg-muted/30 rounded-2xl border border-border/30">
        <span className="text-sm text-muted-foreground">Loading benchmark runs...</span>
      </div>
    );
  }

  if (!selectedRun) {
    return (
      <div className="flex items-center justify-center py-4 px-6 bg-muted/30 rounded-2xl border border-border/30">
        <span className="text-sm text-muted-foreground">No benchmark runs available.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 py-4 px-6 bg-muted/30 rounded-2xl border border-border/30">
      {/* Run name */}
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Benchmark Run</span>
        <span className="text-sm font-medium text-foreground">{selectedRun.name}</span>
        {selectedRun.isLatest && (
          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary rounded-full">
            Latest
          </span>
        )}
      </div>
      
      {/* Divider */}
      <div className="hidden sm:block w-px h-4 bg-border" />
      
      {/* Date */}
      <div className="flex items-center gap-2">
        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{formatDate(selectedRun.date)}</span>
      </div>
      
      {/* Divider */}
      <div className="hidden sm:block w-px h-4 bg-border" />
      
      {/* Models */}
      <div className="flex items-center gap-2 flex-wrap justify-center">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Models</span>
        <div className="flex items-center gap-1.5">
          {selectedRun.models.slice(0, 3).map((model, i) => (
            <span 
              key={i}
              className="px-2 py-0.5 text-xs bg-secondary/50 text-secondary-foreground rounded-full"
            >
              {model}
            </span>
          ))}
          {selectedRun.models.length > 3 && (
            <span className="text-xs text-muted-foreground">
              +{selectedRun.models.length - 3}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
