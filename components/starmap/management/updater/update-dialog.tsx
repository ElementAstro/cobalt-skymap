'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Download, 
  RefreshCw, 
  X, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Rocket,
  SkipForward,
} from 'lucide-react';
import { useUpdater } from '@/lib/tauri/updater-hooks';
import { formatProgress, formatBytes } from '@/lib/tauri/updater-api';
import { openExternalUrl } from '@/lib/tauri/app-control-api';
import { EXTERNAL_LINKS } from '@/lib/constants/external-links';

interface UpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Escape HTML entities to prevent XSS.
 * SECURITY: This MUST run before any regex-based markdown substitution
 * so that user-supplied content cannot inject HTML/JS.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Minimal markdown-to-HTML renderer for release notes.
 *
 * SECURITY ANALYSIS:
 * 1. `escapeHtml` runs first — all `<`, `>`, `&`, `"`, `'` are entity-encoded.
 * 2. Regex substitutions only produce a fixed set of safe HTML tags
 *    (h3, strong, em, code, li, br) with static class attributes.
 * 3. Capture groups ($1) contain only escaped content — no raw HTML can survive.
 * 4. Input source is the Tauri updater's `body` field (GitHub release notes),
 *    which is author-controlled, not user-supplied.
 *
 * If a full markdown library is ever added to the project (e.g. react-markdown),
 * this function should be replaced with it.
 */
function renderMarkdown(text: string): string {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-semibold mt-3 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h3 class="text-sm font-semibold mt-3 mb-1">$1</h3>')
    .replace(/^# (.+)$/gm, '<h3 class="text-base font-bold mt-3 mb-1">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="px-1 py-0.5 rounded bg-muted-foreground/10 text-xs">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^\* (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/\n{2,}/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.ceil(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function shouldOfferReleasesFallback(error: string | null): boolean {
  if (!error) return false;

  return /(not configured|signature|platform|manifest|latest\.json|github releases)/i.test(error);
}

export function UpdateDialog({ open, onOpenChange }: UpdateDialogProps) {
  const t = useTranslations('updater');
  const {
    currentVersion,
    isChecking,
    isDownloading,
    isReady,
    hasUpdate,
    updateInfo,
    progress,
    error,
    downloadSpeed,
    estimatedTimeRemaining,
    checkForUpdate,
    downloadAndInstall,
    dismissUpdate,
    skipVersion,
  } = useUpdater();

  const handleClose = () => {
    if (!isDownloading) {
      onOpenChange(false);
    }
  };

  const handleDismiss = () => {
    dismissUpdate();
    onOpenChange(false);
  };

  const handleSkipVersion = () => {
    if (updateInfo) {
      skipVersion(updateInfo.version);
      onOpenChange(false);
    }
  };

  const handleOpenReleases = async () => {
    await openExternalUrl(EXTERNAL_LINKS.releases);
  };

  const bodyText = updateInfo?.body ?? null;
  const releaseNotesHtml = useMemo(() => {
    if (!bodyText) return null;
    return renderMarkdown(bodyText);
  }, [bodyText]);

  const renderContent = () => {
    if (isChecking) {
      return (
        <div className="flex flex-col items-center gap-4 py-6">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">{t('checking')}</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center gap-4 py-6">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <p className="text-destructive">{error}</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button onClick={checkForUpdate} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              {t('retry')}
            </Button>
            {shouldOfferReleasesFallback(error) && (
              <Button onClick={handleOpenReleases}>
                <Download className="mr-2 h-4 w-4" />
                {t('openReleases')}
              </Button>
            )}
          </div>
        </div>
      );
    }

    if (isDownloading && progress) {
      return (
        <div className="flex flex-col gap-4 py-6">
          <div className="flex items-center gap-4">
            <Download className="h-8 w-8 text-primary animate-pulse" />
            <div className="flex-1">
              <p className="font-medium">{t('downloading')}</p>
              <p className="text-sm text-muted-foreground">
                {formatProgress(progress)}
              </p>
              {(downloadSpeed !== null || estimatedTimeRemaining !== null) && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {downloadSpeed !== null && (
                    <span>{t('downloadSpeed', { speed: formatBytes(downloadSpeed) })}</span>
                  )}
                  {downloadSpeed !== null && estimatedTimeRemaining !== null && (
                    <span className="mx-1">·</span>
                  )}
                  {estimatedTimeRemaining !== null && (
                    <span>{t('timeRemaining', { time: formatEta(estimatedTimeRemaining) })}</span>
                  )}
                </p>
              )}
            </div>
          </div>
          <Progress value={progress.percent} className="h-2" />
        </div>
      );
    }

    if (isReady && updateInfo) {
      return (
        <div className="flex flex-col items-center gap-4 py-6">
          <CheckCircle2 className="h-12 w-12 text-green-500" />
          <div className="text-center">
            <p className="font-medium">{t('ready')}</p>
            <p className="text-sm text-muted-foreground">
              {t('restartRequired')}
            </p>
          </div>
        </div>
      );
    }

    if (hasUpdate && updateInfo) {
      return (
        <div className="flex flex-col gap-4 py-4">
          <div className="flex items-start gap-4">
            <Rocket className="h-8 w-8 text-primary" />
            <div className="flex-1">
              <p className="font-medium">
                {t('newVersion', { version: updateInfo.version })}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('currentVersion', { version: currentVersion || '0.0.0' })}
              </p>
            </div>
          </div>
          
          {releaseNotesHtml && (
            <ScrollArea className="max-h-48">
              <div className="rounded-lg bg-muted p-3">
                <p className="text-sm font-medium mb-2">{t('releaseNotes')}</p>
                <div
                  className="text-sm text-muted-foreground prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: releaseNotesHtml }}
                />
              </div>
            </ScrollArea>
          )}
          
          {updateInfo.date && (
            <p className="text-xs text-muted-foreground">
              {t('releaseDate', { 
                date: new Date(updateInfo.date).toLocaleDateString() 
              })}
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <CheckCircle2 className="h-12 w-12 text-green-500" />
        <div className="text-center">
          <p className="font-medium">{t('upToDate')}</p>
          <p className="text-sm text-muted-foreground">
            {t('currentVersion', { version: currentVersion || '0.0.0' })}
          </p>
        </div>
        <Button onClick={checkForUpdate} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          {t('checkAgain')}
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {t('description')}
          </DialogDescription>
        </DialogHeader>
        
        {renderContent()}
        
        <DialogFooter className="gap-2 sm:gap-0">
          {hasUpdate && !isDownloading && !isReady && (
            <>
              <Button variant="ghost" size="sm" onClick={handleSkipVersion}>
                <SkipForward className="mr-2 h-4 w-4" />
                {t('skipVersion')}
              </Button>
              <Button variant="ghost" onClick={handleDismiss}>
                <X className="mr-2 h-4 w-4" />
                {t('later')}
              </Button>
              <Button onClick={downloadAndInstall}>
                <Download className="mr-2 h-4 w-4" />
                {t('updateNow')}
              </Button>
            </>
          )}
          
          {isReady && (
            <Button onClick={downloadAndInstall}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t('restartNow')}
            </Button>
          )}
          
          {!hasUpdate && !isChecking && !error && (
            <Button variant="outline" onClick={handleClose}>
              {t('close')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
