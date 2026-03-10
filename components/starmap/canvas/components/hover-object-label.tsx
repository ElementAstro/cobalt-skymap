'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface HoverObjectLabelProps {
  name: string;
  x: number;
  y: number;
  className?: string;
}

/**
 * Lightweight label used for pixel-tracked hover metadata over sky canvases.
 * It is intentionally non-interactive to avoid focus/hover traps over WebGL.
 */
export function HoverObjectLabel({ name, x, y, className }: HoverObjectLabelProps) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute z-50', className)}
      style={{ left: x + 12, top: y - 8 }}
    >
      <Badge
        variant="outline"
        className="border-border/70 bg-background/90 px-2 py-0.5 text-xs text-foreground shadow-sm backdrop-blur-sm"
      >
        {name}
      </Badge>
    </div>
  );
}

