'use client';

import { useRef, useId } from 'react';
import { useTranslations } from 'next-intl';
import { X, ChevronLeft, ChevronRight, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { getArrowStyles } from '@/lib/constants/onboarding';
import { useTourPosition } from '@/lib/hooks/use-tour-position';
import { useFocusTrap } from '@/lib/hooks/use-focus-trap';
import type { TourTooltipProps } from '@/types/starmap/onboarding';

export function TourTooltip({
  step,
  currentIndex,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
  onClose,
  isFirst,
  isLast,
}: TourTooltipProps) {
  const t = useTranslations();
  const tooltipRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  const { position, isVisible } = useTourPosition(step, tooltipRef);
  useFocusTrap(tooltipRef, [step.id]);

  const arrowStyles = getArrowStyles(position.arrowPosition, position.arrowOffset);

  return (
    <div
      ref={tooltipRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      tabIndex={-1}
      className={cn(
        'fixed z-[9999] w-[min(320px,calc(100vw-var(--safe-area-left)-var(--safe-area-right)-32px))] max-h-[calc(100vh-var(--safe-area-top)-var(--safe-area-bottom)-32px)] max-h-[calc(100dvh-var(--safe-area-top)-var(--safe-area-bottom)-32px)] overflow-y-auto bg-card/95 backdrop-blur-md text-card-foreground rounded-lg shadow-2xl border border-border outline-none',
        isVisible ? 'tour-tooltip-enter' : 'opacity-0 scale-95'
      )}
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      {arrowStyles && <div style={arrowStyles} />}

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <Badge className="h-6 w-6 justify-center p-0 text-xs font-bold" aria-hidden="true">
            {currentIndex + 1}
          </Badge>
          <span className="text-xs text-muted-foreground" role="status">
            {t('onboarding.stepOf', { current: currentIndex + 1, total: totalSteps })}
          </span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted"
              onClick={onClose}
              aria-label={t('onboarding.skip')}
            >
              <X className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {t('onboarding.skip')}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Content */}
      <div className="px-4 pb-2">
        <h3 id={titleId} className="text-lg font-semibold mb-2">
          {t(step.titleKey)}
        </h3>
        <p id={descId} className="text-sm text-muted-foreground leading-relaxed">
          {t(step.descriptionKey)}
        </p>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-1.5 py-2" aria-hidden="true">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 rounded-full tour-progress-dot',
              i === currentIndex
                ? 'w-4 bg-primary tour-progress-dot-active'
                : i < currentIndex
                ? 'w-1.5 bg-primary/50'
                : 'w-1.5 bg-muted'
            )}
          />
        ))}
      </div>

      {/* Footer */}
      <Separator />
      <div className="flex items-center justify-between px-4 pb-4 pt-2">
        <div>
          {step.showSkip !== false && !isLast && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground hover:bg-muted"
              onClick={onSkip}
            >
              <SkipForward className="h-4 w-4 mr-1" />
              {t('onboarding.skip')}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isFirst && (
            <Button
              variant="outline"
              size="sm"
              className="border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={onPrev}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              {t('onboarding.prev')}
            </Button>
          )}
          <Button
            size="sm"
            className="bg-primary hover:bg-primary/90"
            onClick={onNext}
          >
            {isLast ? (
              t('onboarding.finish')
            ) : (
              <>
                {t('onboarding.next')}
                <ChevronRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
