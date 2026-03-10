'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ColorPickerProps {
  colors: readonly string[];
  value: string;
  onChange: (color: string) => void;
  className?: string;
}

export function ColorPicker({
  colors,
  value,
  onChange,
  className,
}: ColorPickerProps) {
  return (
    <div className={cn('flex gap-1', className)}>
      {colors.map((color) => (
        <Button
          key={color}
          variant="outline"
          size="icon"
          className={cn(
            'w-7 h-7 p-0 hover:scale-110 transition-transform',
            value === color && 'ring-2 ring-primary ring-offset-2'
          )}
          style={{ backgroundColor: color }}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  );
}
