import { cn } from '@/lib/utils';

interface ScoreBadgeProps {
  score: number;
  maxScore?: number;
  label?: string;
  className?: string;
}

export function ScoreBadge({ score, maxScore = 5, label, className }: ScoreBadgeProps) {
  const percentage = score / maxScore;
  const scoreClass = percentage >= 0.7 ? 'score-high' : percentage >= 0.4 ? 'score-medium' : 'score-low';
  
  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <span className={cn('score-badge', scoreClass)}>
        {score}
      </span>
      {label && (
        <span className="text-sm text-muted-foreground">{label}</span>
      )}
    </div>
  );
}
