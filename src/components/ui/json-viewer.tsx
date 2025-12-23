import { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

interface JsonViewerProps {
  data: unknown;
  className?: string;
  defaultExpanded?: boolean;
}

export function JsonViewer({ data, className, defaultExpanded = true }: JsonViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('relative group', className)}>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      </Button>
      <pre className="p-4 rounded-lg bg-muted/50 overflow-x-auto text-sm font-mono">
        <JsonNode data={data} level={0} expanded={defaultExpanded} />
      </pre>
    </div>
  );
}

interface JsonNodeProps {
  data: unknown;
  level: number;
  expanded?: boolean;
}

function JsonNode({ data, level, expanded = true }: JsonNodeProps) {
  const [isExpanded, setIsExpanded] = useState(expanded);
  const indent = '  '.repeat(level);

  if (data === null) {
    return <span className="text-muted-foreground">null</span>;
  }

  if (typeof data === 'boolean') {
    return <span className="json-boolean">{data.toString()}</span>;
  }

  if (typeof data === 'number') {
    return <span className="json-number">{data}</span>;
  }

  if (typeof data === 'string') {
    return <span className="json-string">"{data}"</span>;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return <span>[]</span>;
    }

    return (
      <span>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="inline-flex items-center hover:text-primary transition-colors"
        >
          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
        {'['}
        {isExpanded ? (
          <>
            {'\n'}
            {data.map((item, index) => (
              <span key={index}>
                {indent}  <JsonNode data={item} level={level + 1} />
                {index < data.length - 1 ? ',' : ''}
                {'\n'}
              </span>
            ))}
            {indent}
          </>
        ) : (
          <span className="text-muted-foreground"> ... {data.length} items </span>
        )}
        {']'}
      </span>
    );
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data);
    if (entries.length === 0) {
      return <span>{'{}'}</span>;
    }

    return (
      <span>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="inline-flex items-center hover:text-primary transition-colors"
        >
          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
        {'{'}
        {isExpanded ? (
          <>
            {'\n'}
            {entries.map(([key, value], index) => (
              <span key={key}>
                {indent}  <span className="json-key">"{key}"</span>: <JsonNode data={value} level={level + 1} />
                {index < entries.length - 1 ? ',' : ''}
                {'\n'}
              </span>
            ))}
            {indent}
          </>
        ) : (
          <span className="text-muted-foreground"> ... {entries.length} keys </span>
        )}
        {'}'}
      </span>
    );
  }

  return <span>{String(data)}</span>;
}
