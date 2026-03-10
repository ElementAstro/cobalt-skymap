'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  CheckCircle,
  XCircle,
  MapPin,
  RotateCw,
  Ruler,
  Eye,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { SolveResultCardProps } from '@/types/starmap/plate-solving';

// Re-export types for backward compatibility
export type { SolveResultCardProps } from '@/types/starmap/plate-solving';

// ============================================================================
// Component
// ============================================================================

export function SolveResultCard({ result, onGoTo }: SolveResultCardProps) {
  const t = useTranslations();
  const [copied, setCopied] = useState(false);
  const parsedError = (() => {
    if (!result.errorMessage) return { code: null as string | null, message: null as string | null, attempts: null as string | null };
    const codeMatch = result.errorMessage.match(/^\[([a-z_]+)\]\s*(.*)$/i);
    const message = codeMatch ? codeMatch[2] : result.errorMessage;
    const attemptsMatch = message.match(/\(Attempt\s+(\d+\/\d+)\)\s*$/i);
    return {
      code: codeMatch ? codeMatch[1] : null,
      message: attemptsMatch ? message.replace(attemptsMatch[0], '').trim() : message,
      attempts: attemptsMatch ? attemptsMatch[1] : null,
    };
  })();

  const handleCopyCoordinates = useCallback(async () => {
    if (!result.success || !result.coordinates) return;
    const text = `RA: ${result.coordinates.raHMS}  Dec: ${result.coordinates.decDMS}  PA: ${result.positionAngle.toFixed(2)}°  Scale: ${result.pixelScale.toFixed(2)}"/px  FOV: ${result.fov.width.toFixed(2)}° × ${result.fov.height.toFixed(2)}°`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }, [result]);

  return (
    <Card className={result.success ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 mb-3">
          {result.success ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : (
            <XCircle className="h-5 w-5 text-red-500" />
          )}
          <span className="font-medium">
            {result.success 
              ? (t('plateSolving.solveSuccess') || 'Plate Solve Successful!')
              : (t('plateSolving.solveFailed') || 'Plate Solve Failed')
            }
          </span>
        </div>

        {result.success && result.coordinates && (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{t('coordinates.ra')}: {result.coordinates.raHMS}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{t('coordinates.dec')}: {result.coordinates.decDMS}</span>
            </div>
            <div className="flex items-center gap-2">
              <RotateCw className="h-4 w-4 text-muted-foreground" />
              <span>{t('plateSolving.rotation') || 'Rotation'}: {result.positionAngle.toFixed(2)}°</span>
            </div>
            <div className="flex items-center gap-2">
              <Ruler className="h-4 w-4 text-muted-foreground" />
              <span>{t('plateSolving.pixelScale') || 'Scale'}: {result.pixelScale.toFixed(2)}&quot;/px</span>
            </div>
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span>{t('plateSolving.fov') || 'FOV'}: {result.fov.width.toFixed(2)}° × {result.fov.height.toFixed(2)}°</span>
            </div>

            <div className="flex gap-2 mt-3">
              {onGoTo && (
                <Button onClick={onGoTo} className="flex-1">
                  <MapPin className="h-4 w-4 mr-2" />
                  {t('plateSolving.goToPosition') || 'Go to Position'}
                </Button>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size={onGoTo ? 'icon' : 'default'}
                    className={onGoTo ? '' : 'flex-1'}
                    onClick={handleCopyCoordinates}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {!onGoTo && (
                      <span className="ml-2">
                        {copied ? (t('common.copied') || 'Copied!') : (t('common.copy') || 'Copy')}
                      </span>
                    )}
                  </Button>
                </TooltipTrigger>
                {onGoTo && (
                  <TooltipContent>
                    {copied ? (t('common.copied') || 'Copied!') : (t('plateSolving.copyCoordinates') || 'Copy Coordinates')}
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
          </div>
        )}

        {!result.success && result.errorMessage && (
          <Alert variant="destructive" className="mt-2">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              {parsedError.message}
              {parsedError.code && (
                <span className="ml-2 text-xs uppercase tracking-wide">
                  ({parsedError.code})
                </span>
              )}
              {parsedError.attempts && (
                <span className="ml-2 text-xs">
                  {t('plateSolving.retryOnFailure') || 'Retry'} {parsedError.attempts}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        <p className="text-xs text-muted-foreground mt-2">
          {t('plateSolving.solveTime') || 'Solve time'}: {(result.solveTime / 1000).toFixed(1)}s
          <span className="ml-2">• {result.solverName}</span>
        </p>
      </CardContent>
    </Card>
  );
}
