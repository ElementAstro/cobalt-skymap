'use client';

import { useState, useCallback, memo } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, History, Trash2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { EmptyState } from '@/components/ui/empty-state';
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
import { cn } from '@/lib/utils';
import {
  useNavigationHistoryStore,
  formatNavigationPoint,
  formatTimestamp,
  type NavigationPoint,
} from '@/lib/hooks/use-navigation-history';
import type { NavigationHistoryProps } from '@/types/starmap/controls';

export const NavigationHistory = memo(function NavigationHistory({ onNavigate, className }: NavigationHistoryProps) {
  const t = useTranslations();
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const {
    history,
    currentIndex,
    back,
    forward,
    goTo,
    canGoBack,
    canGoForward,
    clear,
  } = useNavigationHistoryStore();

  const handleBack = useCallback(() => {
    const point = back();
    if (point && onNavigate) {
      onNavigate(point.ra, point.dec, point.fov);
    }
  }, [back, onNavigate]);

  const handleForward = useCallback(() => {
    const point = forward();
    if (point && onNavigate) {
      onNavigate(point.ra, point.dec, point.fov);
    }
  }, [forward, onNavigate]);

  const handleSelectPoint = useCallback((_point: NavigationPoint, index: number) => {
    // Use goTo to sync currentIndex with the selected history point
    const navigatedPoint = goTo(index);
    if (navigatedPoint && onNavigate) {
      onNavigate(navigatedPoint.ra, navigatedPoint.dec, navigatedPoint.fov);
    }
  }, [goTo, onNavigate]);

  const isBackEnabled = canGoBack();
  const isForwardEnabled = canGoForward();

  return (
    <div className={cn('flex items-center gap-0.5', className)} role="navigation" aria-label={t('navigation.viewHistory')}>
      <ButtonGroup role="presentation" className="gap-0.5">
        {/* Back Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-foreground/80 hover:text-foreground hover:bg-accent disabled:opacity-30"
              onClick={handleBack}
              disabled={!isBackEnabled}
              aria-label={t('navigation.back')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{t('navigation.back')}</p>
          </TooltipContent>
        </Tooltip>

        {/* Forward Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-foreground/80 hover:text-foreground hover:bg-accent disabled:opacity-30"
              onClick={handleForward}
              disabled={!isForwardEnabled}
              aria-label={t('navigation.forward')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{t('navigation.forward')}</p>
          </TooltipContent>
        </Tooltip>

        {/* History Dropdown */}
        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-foreground/80 hover:text-foreground hover:bg-accent"
                  aria-label={t('navigation.history')}
                  data-tour-id="navigation-history"
                >
                  <History className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{t('navigation.history')}</p>
            </TooltipContent>
          </Tooltip>

          <PopoverContent className="w-72 p-0 animate-in fade-in zoom-in-95 slide-in-from-top-2" align="end">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <History className="h-4 w-4" />
              {t('navigation.viewHistory')}
            </h4>
            {history.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setClearConfirmOpen(true)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('navigation.clearHistory')}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

            <ScrollArea className="max-h-64">
              {history.length === 0 ? (
                <EmptyState
                  icon={MapPin}
                  message={t('navigation.noHistory')}
                  iconClassName="opacity-30"
                />
              ) : (
                <ItemGroup className="py-1">
                  {[...history].reverse().map((point, reverseIndex) => {
                    const actualIndex = history.length - 1 - reverseIndex;
                    const isCurrent = actualIndex === currentIndex;
                    
                    return (
                      <Item
                        key={point.id}
                        asChild
                        variant={isCurrent ? 'muted' : 'default'}
                        size="sm"
                        className={cn(
                          'w-full rounded-none border-0 px-3 py-2 hover:bg-accent/80',
                          isCurrent && 'bg-primary/10 border-l-2 border-l-primary'
                        )}
                      >
                        <button
                          type="button"
                          className="cursor-pointer text-left"
                          onClick={() => handleSelectPoint(point, actualIndex)}
                        >
                          <ItemMedia className="h-auto w-auto shrink-0 bg-transparent p-0">
                            <MapPin className={cn(
                              'h-3 w-3 shrink-0',
                              isCurrent ? 'text-primary' : 'text-muted-foreground'
                            )} />
                          </ItemMedia>
                          <ItemContent className="min-w-0 gap-0">
                            <ItemTitle className={cn(
                              'truncate',
                              isCurrent && 'text-primary'
                            )}>
                              {formatNavigationPoint(point)}
                            </ItemTitle>
                            <ItemDescription className="line-clamp-1 text-xs text-muted-foreground">
                              {t('navigation.fovLabel')}: {point.fov.toFixed(1)}° • {formatTimestamp(point.timestamp, {
                                justNow: t('navigation.justNow'),
                                minutesAgo: (mins) => t('navigation.minutesAgo', { count: mins }),
                                hoursAgo: (hours) => t('navigation.hoursAgo', { count: hours }),
                              })}
                            </ItemDescription>
                          </ItemContent>
                        </button>
                      </Item>
                    );
                  })}
                </ItemGroup>
              )}
            </ScrollArea>

            {history.length > 0 && (
              <>
                <Separator />
                <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                  {t('navigation.historyCount', { count: history.length })}
                </div>
              </>
            )}
          </PopoverContent>
        </Popover>
      </ButtonGroup>
      {/* Clear History Confirmation */}
      <AlertDialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('navigation.confirmClearTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('navigation.confirmClearHistory')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                clear();
                setClearConfirmOpen(false);
              }}
            >
              {t('navigation.clearHistory')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});
NavigationHistory.displayName = 'NavigationHistory';
