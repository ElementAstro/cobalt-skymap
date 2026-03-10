'use client';

/**
 * Log Viewer Component
 * 
 * A comprehensive log viewing panel with filtering, searching,
 * and export capabilities.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Bug,
  Info,
  AlertTriangle,
  XCircle,
  Search,
  Trash2,
  Download,
  X,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  RefreshCw,
  FileText,
  FileJson,
  Settings2,
  Pause,
  Play,
  ArrowDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useLogStore } from '@/lib/stores/log-store';
import {
  LogLevel,
  LogEntry,
  formatTimestamp,
  serializeData,
  formatLogEntryToText,
  groupConsecutiveLogs,
  type GroupedLogEntry,
} from '@/lib/logger';

/**
 * Highlight matching search text in a string
 */
function HighlightedText({ text, search }: { text: string; search?: string }) {
  if (!search || !search.trim()) {
    return <>{text}</>;
  }
  
  const parts: React.ReactNode[] = [];
  const lowerText = text.toLowerCase();
  const lowerSearch = search.toLowerCase();
  let lastIndex = 0;
  let matchIndex = lowerText.indexOf(lowerSearch);
  let key = 0;
  
  while (matchIndex !== -1) {
    if (matchIndex > lastIndex) {
      parts.push(text.slice(lastIndex, matchIndex));
    }
    parts.push(
      <mark key={key++} className="bg-yellow-300/60 dark:bg-yellow-500/40 rounded-sm px-0.5">
        {text.slice(matchIndex, matchIndex + search.length)}
      </mark>
    );
    lastIndex = matchIndex + search.length;
    matchIndex = lowerText.indexOf(lowerSearch, lastIndex);
  }
  
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  
  return <>{parts}</>;
}

interface LogEntryRowProps {
  entry: LogEntry;
  isExpanded: boolean;
  onToggleExpand: () => void;
  searchText?: string;
  repeatCount?: number;
}

const LogLevelIcon: React.FC<{ level: LogLevel; className?: string }> = ({ level, className }) => {
  switch (level) {
    case LogLevel.DEBUG:
      return <Bug className={cn('h-4 w-4 text-muted-foreground', className)} />;
    case LogLevel.INFO:
      return <Info className={cn('h-4 w-4 text-blue-500', className)} />;
    case LogLevel.WARN:
      return <AlertTriangle className={cn('h-4 w-4 text-yellow-500', className)} />;
    case LogLevel.ERROR:
      return <XCircle className={cn('h-4 w-4 text-red-500', className)} />;
    default:
      return null;
  }
};

const LogEntryRow: React.FC<LogEntryRowProps> = ({ entry, isExpanded, onToggleExpand, searchText, repeatCount }) => {
  const t = useTranslations('logViewer');
  const [copied, setCopied] = useState(false);
  const hasDetails = entry.data !== undefined || entry.stack;
  
  const handleCopy = useCallback(() => {
    const text = formatLogEntryToText(entry);
    
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [entry]);
  
  return (
    <div
      className={cn(
        'group border-b border-border/50 hover:bg-muted/30 transition-colors',
        entry.level === LogLevel.ERROR && 'bg-red-500/5',
        entry.level === LogLevel.WARN && 'bg-yellow-500/5'
      )}
      role={hasDetails ? 'button' : undefined}
      aria-expanded={hasDetails ? isExpanded : undefined}
    >
      <div
        className="flex items-start gap-2 px-3 py-2 cursor-pointer"
        onClick={hasDetails ? onToggleExpand : undefined}
      >
        <LogLevelIcon level={entry.level} className="mt-0.5 flex-shrink-0" />
        
        <span className="text-xs text-muted-foreground font-mono flex-shrink-0 mt-0.5">
          {formatTimestamp(entry.timestamp)}
        </span>
        
        <Badge variant="outline" className="text-xs font-mono flex-shrink-0">
          {entry.module}
        </Badge>
        
        {repeatCount && repeatCount > 1 && (
          <Badge variant="secondary" className="text-xs font-mono flex-shrink-0 tabular-nums">
            ×{repeatCount}
          </Badge>
        )}
        
        <span className="text-sm flex-1 break-words">
          <HighlightedText text={entry.message} search={searchText} />
        </span>
        
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopy();
                }}
              >
                {copied ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">{t('copy')}</TooltipContent>
          </Tooltip>
          
          {hasDetails && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand();
              }}
            >
              {isExpanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </Button>
          )}
        </div>
      </div>
      
      {hasDetails && isExpanded && (
        <div className="px-3 pb-2 ml-6 space-y-2">
          {entry.data !== undefined && (
            <div className="bg-muted/50 rounded p-2">
              <div className="text-xs text-muted-foreground mb-1">{t('data')}</div>
              <pre className="text-xs font-mono whitespace-pre-wrap break-words overflow-x-auto">
                {serializeData(entry.data)}
              </pre>
            </div>
          )}
          
          {entry.stack && (
            <div className="bg-red-500/10 rounded p-2">
              <div className="text-xs text-red-500 mb-1">{t('stackTrace')}</div>
              <pre className="text-xs font-mono whitespace-pre-wrap break-words overflow-x-auto text-red-400">
                {entry.stack}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const MemoizedLogEntryRow = React.memo(LogEntryRow);

export interface LogViewerProps {
  className?: string;
  maxHeight?: string | number;
  showToolbar?: boolean;
  showStats?: boolean;
}

export function LogViewer({
  className,
  maxHeight = '400px',
  showToolbar = true,
  showStats = true,
}: LogViewerProps) {
  const t = useTranslations('logViewer');
  const parentRef = useRef<HTMLDivElement>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [pausedLogCount, setPausedLogCount] = useState(0);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [groupDuplicates, setGroupDuplicates] = useState(true);
  
  const {
    logs,
    totalCount,
    filter,
    modules,
    stats,
    autoScroll,
    setFilter,
    clearFilter,
    clearLogs,
    downloadLogs,
    refresh,
    setAutoScroll,
  } = useLogStore();
  
  // Track the snapshot of logs when paused
  const pausedLogsRef = useRef<LogEntry[]>([]);
  const prevLogCountRef = useRef(0);
  
  // Determine which logs to display
  const displayLogs = useMemo(() => {
    if (isPaused) {
      return pausedLogsRef.current;
    }
    return logs;
  }, [isPaused, logs]);
  
  // Group consecutive duplicates
  const groupedLogs = useMemo(() => {
    if (!groupDuplicates) return null;
    return groupConsecutiveLogs(displayLogs);
  }, [displayLogs, groupDuplicates]);
  
  const virtualCount = groupedLogs ? groupedLogs.length : displayLogs.length;
  
  // Track new logs arriving while paused
  useEffect(() => {
    if (isPaused) {
      const newCount = logs.length - pausedLogsRef.current.length;
      setPausedLogCount(Math.max(0, newCount));
    }
  }, [isPaused, logs]);
  
  // Virtual scrolling
  const rowVirtualizer = useVirtualizer({
    count: virtualCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });
  
  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && !isPaused && virtualCount > 0 && virtualCount !== prevLogCountRef.current) {
      rowVirtualizer.scrollToIndex(virtualCount - 1, { align: 'end' });
    }
    prevLogCountRef.current = virtualCount;
  }, [virtualCount, autoScroll, isPaused, rowVirtualizer]);
  
  // Track scroll position to show/hide scroll-to-bottom button
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    
    const handleScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
      setIsAtBottom(atBottom);
    };
    
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);
  
  // Initial refresh
  useEffect(() => {
    refresh();
  }, [refresh]);
  
  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);
  
  const handleLevelChange = useCallback((value: string) => {
    if (value === 'all') {
      setFilter({ level: undefined });
    } else {
      setFilter({ level: parseInt(value) as LogLevel });
    }
  }, [setFilter]);
  
  const handleModuleChange = useCallback((value: string) => {
    if (value === 'all') {
      setFilter({ module: undefined });
    } else {
      setFilter({ module: value });
    }
  }, [setFilter]);
  
  // Fix: use local state for search input to avoid controlled-value "jumping"
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); }, []);
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchText(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setFilter({ search: value || undefined });
    }, 200);
  }, [setFilter]);
  
  // Pause/Resume handlers
  const handlePause = useCallback(() => {
    pausedLogsRef.current = logs;
    setPausedLogCount(0);
    setIsPaused(true);
  }, [logs]);
  
  const handleResume = useCallback(() => {
    setIsPaused(false);
    setPausedLogCount(0);
    pausedLogsRef.current = [];
  }, []);
  
  const scrollToBottom = useCallback(() => {
    if (virtualCount > 0) {
      rowVirtualizer.scrollToIndex(virtualCount - 1, { align: 'end' });
    }
  }, [virtualCount, rowVirtualizer]);
  
  return (
    <div className={cn('flex flex-col bg-background border rounded-lg', className)}>
      {/* Toolbar */}
      {showToolbar && (
        <div className="flex items-center gap-2 p-2 border-b">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('searchPlaceholder')}
              value={searchText}
              onChange={handleSearchChange}
              className="pl-8 h-8"
            />
          </div>
          
          {/* Level Filter */}
          <Select
            value={filter.level !== undefined ? String(filter.level) : 'all'}
            onValueChange={handleLevelChange}
          >
            <SelectTrigger className="w-[100px] h-8">
              <SelectValue placeholder={t('allLevels')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allLevels')}</SelectItem>
              <SelectItem value={String(LogLevel.DEBUG)}>{t('debug')}</SelectItem>
              <SelectItem value={String(LogLevel.INFO)}>{t('info')}</SelectItem>
              <SelectItem value={String(LogLevel.WARN)}>{t('warn')}</SelectItem>
              <SelectItem value={String(LogLevel.ERROR)}>{t('error')}</SelectItem>
            </SelectContent>
          </Select>
          
          {/* Module Filter */}
          <Select
            value={filter.module || 'all'}
            onValueChange={handleModuleChange}
          >
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue placeholder={t('allModules')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allModules')}</SelectItem>
              {modules.map((module) => (
                <SelectItem key={module} value={module}>
                  {module}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Actions */}
          <div className="flex items-center gap-1">
            {/* Pause / Resume */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn('h-8 w-8', isPaused && 'text-yellow-500')}
                  onClick={isPaused ? handleResume : handlePause}
                >
                  {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isPaused ? t('resume') : t('pause')}
                {isPaused && pausedLogCount > 0 && ` (${pausedLogCount})`}
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Settings2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('settings')}</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={refresh}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('refresh')}</TooltipContent>
            </Tooltip>
            
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Download className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>{t('export')}</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => downloadLogs('text')}>
                  <FileText className="h-4 w-4 mr-2" />
                  {t('exportText')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadLogs('json')}>
                  <FileJson className="h-4 w-4 mr-2" />
                  {t('exportJson')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={clearLogs}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('clear')}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}
      
      {/* Paused Banner */}
      {isPaused && pausedLogCount > 0 && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-yellow-500/10 border-b text-xs">
          <span className="text-yellow-600 dark:text-yellow-400">
            {t('pausedNewLogs', { count: pausedLogCount })}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={handleResume}
          >
            <Play className="h-3 w-3 mr-1" />
            {t('resume')}
          </Button>
        </div>
      )}
      
      {/* Settings Panel */}
      <Collapsible open={showFilters} onOpenChange={setShowFilters}>
        <CollapsibleContent>
          <div className="p-3 border-b bg-muted/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="auto-scroll"
                    checked={autoScroll}
                    onCheckedChange={setAutoScroll}
                  />
                  <Label htmlFor="auto-scroll" className="text-sm">
                    {t('autoScroll')}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="group-duplicates"
                    checked={groupDuplicates}
                    onCheckedChange={setGroupDuplicates}
                  />
                  <Label htmlFor="group-duplicates" className="text-sm">
                    {t('groupDuplicates')}
                  </Label>
                </div>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => { clearFilter(); setSearchText(''); }}
                className="h-7"
              >
                <X className="h-3 w-3 mr-1" />
                {t('clearFilters')}
              </Button>
            </div>
            
            {/* Time Range Quick Filters */}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground flex-shrink-0">
                {t('timeRange')}
              </Label>
              <div className="flex items-center gap-1">
                {[
                  { label: t('last5min'), minutes: 5 },
                  { label: t('last15min'), minutes: 15 },
                  { label: t('last1hr'), minutes: 60 },
                  { label: t('allTime'), minutes: 0 },
                ].map(({ label, minutes }) => (
                  <Button
                    key={minutes}
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() => {
                      if (minutes === 0) {
                        setFilter({ startTime: undefined, endTime: undefined });
                      } else {
                        setFilter({
                          startTime: new Date(Date.now() - minutes * 60 * 1000),
                          endTime: undefined,
                        });
                      }
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
      
      {/* Stats Bar */}
      {showStats && (
        <div className="flex items-center gap-3 px-3 py-1.5 border-b bg-muted/20 text-xs">
          <span className="text-muted-foreground">
            {t('showing', { count: displayLogs.length, total: totalCount })}
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <span className="flex items-center gap-1">
              <Bug className="h-3 w-3 text-muted-foreground" />
              {stats.byLevel.debug}
            </span>
            <span className="flex items-center gap-1">
              <Info className="h-3 w-3 text-blue-500" />
              {stats.byLevel.info}
            </span>
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-yellow-500" />
              {stats.byLevel.warn}
            </span>
            <span className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" />
              {stats.byLevel.error}
            </span>
          </div>
        </div>
      )}
      
      {/* Log Entries — Virtualized */}
      <div className="relative">
        <div
          ref={parentRef}
          className="overflow-auto"
          style={{ height: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight }}
        >
          {displayLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">{t('noLogs')}</p>
            </div>
          ) : (
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const group: GroupedLogEntry = groupedLogs
                  ? groupedLogs[virtualRow.index]
                  : { entry: displayLogs[virtualRow.index], count: 1, timestamps: [displayLogs[virtualRow.index].timestamp] };
                const { entry, count } = group;
                return (
                  <div
                    key={entry.id}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <MemoizedLogEntryRow
                      entry={entry}
                      isExpanded={expandedIds.has(entry.id)}
                      onToggleExpand={() => toggleExpanded(entry.id)}
                      searchText={filter.search}
                      repeatCount={count}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Scroll to Bottom Button */}
        {!isAtBottom && displayLogs.length > 0 && (
          <Button
            variant="secondary"
            size="sm"
            className="absolute h-8 shadow-md gap-1"
            style={{
              bottom: 'calc(0.75rem + var(--safe-area-bottom))',
              right: 'calc(0.75rem + var(--safe-area-right))',
            }}
            onClick={scrollToBottom}
          >
            <ArrowDown className="h-3.5 w-3.5" />
            {t('scrollToBottom')}
          </Button>
        )}
      </div>
    </div>
  );
}

export default LogViewer;
