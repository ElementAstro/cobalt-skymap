'use client';

/**
 * Log Panel Component
 * 
 * A dialog/sheet wrapper for the LogViewer component.
 * Can be opened via keyboard shortcut or menu item.
 */

import React, { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Terminal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { LogViewer } from './log-viewer';
import { useLogStore, useLogPanel } from '@/lib/stores/log-store';

export interface LogPanelProps {
  /** Keyboard shortcut to toggle the panel */
  shortcut?: string;
}

export function LogPanel({ shortcut = 'ctrl+shift+l' }: LogPanelProps) {
  const t = useTranslations('logViewer');
  const { isOpen, close, toggle } = useLogPanel();
  const { stats } = useLogStore();
  
  // Register keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const keys = shortcut.toLowerCase().split('+');
      const ctrlRequired = keys.includes('ctrl');
      const shiftRequired = keys.includes('shift');
      const altRequired = keys.includes('alt');
      const key = keys.find(k => !['ctrl', 'shift', 'alt'].includes(k));
      
      if (
        e.ctrlKey === ctrlRequired &&
        e.shiftKey === shiftRequired &&
        e.altKey === altRequired &&
        e.key.toLowerCase() === key
      ) {
        e.preventDefault();
        toggle();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcut, toggle]);
  
  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
      <SheetContent side="bottom" className="h-[60vh] h-[60dvh] flex flex-col p-0">
        <SheetHeader className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              <SheetTitle className="text-base">{t('title')}</SheetTitle>
              {stats.byLevel.error > 0 && (
                <span className="px-1.5 py-0.5 text-xs font-medium bg-red-500/10 text-red-500 rounded">
                  {stats.byLevel.error} {t('errors')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {shortcut.toUpperCase().replace(/\+/g, ' + ')}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={close}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <SheetDescription className="sr-only">
            {t('description')}
          </SheetDescription>
        </SheetHeader>
        
        <div className="flex-1 overflow-hidden">
          <LogViewer
            className="h-full border-0 rounded-none"
            maxHeight="100%"
            showToolbar={true}
            showStats={true}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Log Panel Trigger Button
 * 
 * A button to open the log panel, showing error count if any.
 */
export function LogPanelTrigger() {
  const t = useTranslations('logViewer');
  const { open } = useLogPanel();
  const { stats } = useLogStore();
  
  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-2"
      onClick={open}
    >
      <Terminal className="h-4 w-4" />
      <span className="hidden sm:inline">{t('title')}</span>
      {stats.byLevel.error > 0 && (
        <span className="px-1.5 py-0.5 text-xs font-medium bg-red-500/10 text-red-500 rounded">
          {stats.byLevel.error}
        </span>
      )}
    </Button>
  );
}

export default LogPanel;
