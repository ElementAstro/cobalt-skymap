'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { DisplaySettings } from './display-settings';

export function StellariumSettings() {
  const t = useTranslations();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`h-10 w-10 backdrop-blur-sm ${open ? 'bg-primary/30 text-primary' : 'bg-background/60 text-foreground hover:bg-background/80'}`}
            >
              <Settings className="h-5 w-5" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{t('settings.displaySettings')}</p>
        </TooltipContent>
      </Tooltip>
      <DialogContent className="max-w-md max-h-[85vh] max-h-[85dvh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('settings.displaySettings')}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 -mx-2 px-2">
          <DisplaySettings />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
