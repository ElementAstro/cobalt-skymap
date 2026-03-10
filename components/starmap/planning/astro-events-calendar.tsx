'use client';

import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import { useTranslations } from 'next-intl';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock,
  Eclipse,
  Eye,
  MapPin,
  Moon,
  Orbit,
  RefreshCw,
  Settings,
  Sparkles,
  Star,
  Sun,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { useMountStore, useStellariumStore, useEventSourcesStore } from '@/lib/stores';
import {
  type AstroEvent,
  type DailyAstroEvent,
  type EventType,
  fetchAstroEventsInRange,
  fetchDailyAstroEvents,
} from '@/lib/services/astro-data-sources';
import { useAstroEvents } from '@/lib/tauri/hooks';
import { isTauri } from '@/lib/storage/platform';
import { convertTauriEvents } from '@/lib/astronomy/event-utils';
import { createLogger } from '@/lib/logger';
import { EventDetailDialog } from './event-detail-dialog';

const logger = createLogger('astro-events-calendar');

const EVENT_ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  lunar_phase: Moon,
  meteor_shower: Sparkles,
  planet_conjunction: CircleDot,
  eclipse: Eclipse,
  planet_opposition: Orbit,
  planet_elongation: Star,
  equinox_solstice: Sun,
  comet: Star,
  asteroid: CircleDot,
  supernova: Star,
  aurora: Sparkles,
  other: Star,
};

const EVENT_COLOR_MAP: Record<string, string> = {
  lunar_phase: 'text-amber-400 bg-amber-400/10',
  meteor_shower: 'text-purple-400 bg-purple-400/10',
  planet_conjunction: 'text-blue-400 bg-blue-400/10',
  eclipse: 'text-red-400 bg-red-400/10',
  planet_opposition: 'text-orange-400 bg-orange-400/10',
  planet_elongation: 'text-cyan-400 bg-cyan-400/10',
  equinox_solstice: 'text-yellow-400 bg-yellow-400/10',
  comet: 'text-green-400 bg-green-400/10',
  asteroid: 'text-stone-400 bg-stone-400/10',
  supernova: 'text-pink-400 bg-pink-400/10',
  aurora: 'text-emerald-400 bg-emerald-400/10',
  other: 'text-muted-foreground bg-muted',
};

function formatDateKeyInTimezone(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value ?? `${date.getUTCFullYear()}`;
  const month = parts.find((part) => part.type === 'month')?.value ?? `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = parts.find((part) => part.type === 'day')?.value ?? `${date.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sourceIdFromEvent(source: string): string {
  const normalized = source.trim().toLowerCase();
  if (normalized.includes('usno')) return 'usno';
  if (normalized.includes('imo')) return 'imo';
  if (normalized.includes('nasa')) return 'nasa';
  if (normalized.includes('astronomy api')) return 'astronomyapi';
  if (normalized.includes('local')) return 'local';
  if (normalized.includes('mpc') || normalized.includes('minor planet')) return 'mpc';
  if (normalized.includes('desktop')) return 'local';
  return normalized;
}

function getVisibilityBadge(visibility: string, t: ReturnType<typeof useTranslations>) {
  switch (visibility) {
    case 'excellent':
      return <Badge className="bg-green-500/20 text-green-400 text-[10px]">{t('events.excellent')}</Badge>;
    case 'good':
      return <Badge className="bg-blue-500/20 text-blue-400 text-[10px]">{t('events.good')}</Badge>;
    case 'fair':
      return <Badge className="bg-yellow-500/20 text-yellow-400 text-[10px]">{t('events.fair')}</Badge>;
    case 'poor':
      return <Badge className="bg-red-500/20 text-red-400 text-[10px]">{t('events.poor')}</Badge>;
    default:
      return null;
  }
}

function getEventIcon(type: EventType) {
  const Icon = EVENT_ICON_MAP[type] ?? Star;
  return <Icon className="h-4 w-4" />;
}

function getEventColor(type: EventType) {
  return EVENT_COLOR_MAP[type] ?? 'text-muted-foreground bg-muted';
}

function mapToDailyEvents(
  events: AstroEvent[],
  timezone: string,
  selectedDateKey: string,
  sourcePriorityMap: Record<string, number>
): DailyAstroEvent[] {
  return events.map((event) => {
    const startsAt = event.date;
    const endsAt = event.endDate;
    const occurrenceMode = endsAt ? 'window' : 'instant';
    let status: DailyAstroEvent['statusOnSelectedDay'] = 'upcoming_today';
    if (occurrenceMode === 'window') {
      const endDateKey = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(endsAt ?? startsAt);
      status = endDateKey === selectedDateKey ? 'ended_today' : 'ongoing';
    }

    return {
      ...event,
      startsAt,
      endsAt,
      occurrenceMode,
      statusOnSelectedDay: status,
      localDateKey: selectedDateKey,
      sourcePriority: sourcePriorityMap[sourceIdFromEvent(event.source)] ?? 99,
    };
  });
}

function mergeDailyEvents(events: DailyAstroEvent[]): DailyAstroEvent[] {
  const deduped = new Map<string, DailyAstroEvent>();
  events.forEach((event) => {
    const key = `${event.type}|${event.name.trim().toLowerCase()}|${event.startsAt.toISOString().slice(0, 16)}|${event.source.toLowerCase()}`;
    if (!deduped.has(key)) {
      deduped.set(key, event);
    }
  });
  return Array.from(deduped.values()).sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());
}

function EventCard({
  event,
  onGoTo,
  onClick,
}: {
  event: DailyAstroEvent;
  onGoTo?: (ra: number, dec: number) => void;
  onClick?: () => void;
}) {
  const t = useTranslations();

  return (
    <Card
      className={cn('border-border hover:border-primary/50 transition-colors', onClick && 'cursor-pointer')}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className={cn('p-2 rounded-lg', getEventColor(event.type))}>
            {getEventIcon(event.type)}
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-medium truncate">{event.name}</h4>
              {getVisibilityBadge(event.visibility, t)}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{event.description}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>
                {event.startsAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                {event.endsAt ? ` - ${event.endsAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}` : ''}
              </span>
              {event.occurrenceMode === 'window' && (
                <Badge variant="outline" className="text-[10px]">
                  {event.statusOnSelectedDay === 'ongoing' ? t('events.ongoing') : t('events.endsToday')}
                </Badge>
              )}
            </div>
            {event.ra !== undefined && event.dec !== undefined && onGoTo && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={(clickEvent) => {
                  clickEvent.stopPropagation();
                  onGoTo(event.ra!, event.dec!);
                }}
              >
                <Eye className="h-3 w-3 mr-1" />
                {t('events.goToRadiant')}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AstroEventsCalendar() {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filterType, setFilterType] = useState<EventType | 'all'>('all');
  const [dailyEvents, setDailyEvents] = useState<DailyAstroEvent[]>([]);
  const [monthEvents, setMonthEvents] = useState<AstroEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showMonthOverview, setShowMonthOverview] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<AstroEvent | null>(null);
  const [resolvedTimezone, setResolvedTimezone] = useState('Etc/UTC');

  const eventSources = useEventSourcesStore((state) => state.sources);
  const toggleEventSource = useEventSourcesStore((state) => state.toggleSource);
  const setViewDirection = useStellariumStore((state) => state.setViewDirection);
  const profileInfo = useMountStore((state) => state.profileInfo);
  const { getDailyEvents } = useAstroEvents();

  const observer = useMemo(() => ({
    latitude: profileInfo.AstrometrySettings.Latitude ?? 0,
    longitude: profileInfo.AstrometrySettings.Longitude ?? 0,
    elevation: profileInfo.AstrometrySettings.Elevation ?? 0,
  }), [profileInfo.AstrometrySettings.Elevation, profileInfo.AstrometrySettings.Latitude, profileInfo.AstrometrySettings.Longitude]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const sourcePriorityMap = eventSources.reduce<Record<string, number>>((acc, source) => {
          acc[source.id] = source.priority;
          return acc;
        }, {});

        const dailyResult = await fetchDailyAstroEvents({
          date: selectedDate,
          observer,
          includeOngoing: true,
          sourcesOrIds: eventSources,
        });
        const timezone = dailyResult.timezone;
        const selectedDateKey = formatDateKeyInTimezone(selectedDate, timezone);

        const monthlyResult = await fetchAstroEventsInRange({
          startDate: new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
          endDate: new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59),
          observer,
          includeOngoing: true,
          sourcesOrIds: eventSources,
          timezone,
        });

        let combinedDaily = dailyResult.events;
        if (isTauri()) {
          const tauriDailyEvents = await getDailyEvents(selectedDateKey, timezone, true);
          const converted = convertTauriEvents(tauriDailyEvents);
          combinedDaily = mergeDailyEvents([
            ...dailyResult.events,
            ...mapToDailyEvents(converted, timezone, selectedDateKey, sourcePriorityMap),
          ]);
        }

        if (!cancelled) {
          setResolvedTimezone(dailyResult.timezone);
          setDailyEvents(combinedDaily);
          setMonthEvents(monthlyResult);
          setIsOnline(true);
        }
      } catch (error) {
        logger.error('Failed to fetch daily events', error);
        if (!cancelled) {
          setIsOnline(false);
          setDailyEvents([]);
          setMonthEvents([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, selectedDate, observer, eventSources, getDailyEvents]);

  const filteredDailyEvents = useMemo(() => {
    if (filterType === 'all') return dailyEvents;
    return dailyEvents.filter((event) => event.type === filterType);
  }, [dailyEvents, filterType]);

  const exactEvents = useMemo(
    () => filteredDailyEvents.filter((event) => event.occurrenceMode === 'instant'),
    [filteredDailyEvents]
  );
  const ongoingEvents = useMemo(
    () => filteredDailyEvents.filter((event) => event.occurrenceMode === 'window'),
    [filteredDailyEvents]
  );

  const goToPrevDay = useCallback(() => {
    setSelectedDate((prev) => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 1));
  }, []);
  const goToNextDay = useCallback(() => {
    setSelectedDate((prev) => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 1));
  }, []);
  const goToToday = useCallback(() => {
    setSelectedDate(new Date());
  }, []);

  const handleRefresh = useCallback(() => {
    setSelectedDate((prev) => new Date(prev));
  }, []);

  const handleGoTo = useCallback((ra: number, dec: number) => {
    setViewDirection?.(ra, dec);
  }, [setViewDirection]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Calendar className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[640px] max-h-[80vh] max-h-[80dvh] overflow-hidden flex flex-col" data-testid="dialog-content">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            <span>{t('events.astronomicalEvents')}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToPrevDay}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium">
              {selectedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' })}
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToNextDay}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={goToToday}>
              {t('events.today')}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filterType} onValueChange={(value) => setFilterType(value as EventType | 'all')}>
              <SelectTrigger className="w-[160px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('events.allEvents')}</SelectItem>
                <SelectItem value="lunar_phase">{t('events.lunarPhases')}</SelectItem>
                <SelectItem value="meteor_shower">{t('events.meteorShowers')}</SelectItem>
                <SelectItem value="planet_conjunction">{t('events.conjunctions')}</SelectItem>
                <SelectItem value="eclipse">{t('events.eclipses')}</SelectItem>
                <SelectItem value="comet">{t('events.comets')}</SelectItem>
                <SelectItem value="equinox_solstice">{t('events.seasons')}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowSettings((prev) => !prev)}>
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {isOnline ? (
            <Badge variant="outline" className="text-green-500 border-green-500/50">
              <Wifi className="h-3 w-3 mr-1" />
              {t('events.online')}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-yellow-500 border-yellow-500/50">
              <WifiOff className="h-3 w-3 mr-1" />
              {t('events.offline')}
            </Badge>
          )}
          <Badge variant="outline">{t('events.timezone')}: {resolvedTimezone}</Badge>
        </div>

        <Collapsible open={showSettings} onOpenChange={setShowSettings}>
          <CollapsibleContent>
            <Card className="border-dashed">
              <CardContent className="p-3 space-y-2">
                <div className="text-xs font-medium text-muted-foreground mb-2">{t('events.dataSources')}</div>
                {eventSources.map((source) => (
                  <div key={source.id} className="flex items-center justify-between">
                    <Label htmlFor={`source-${source.id}`} className="text-sm">{source.name}</Label>
                    <Switch
                      id={`source-${source.id}`}
                      checked={source.enabled}
                      onCheckedChange={() => toggleEventSource(source.id)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        <ScrollArea className="flex-1 min-h-0 overflow-hidden" data-testid="scroll-area">
          <div className="space-y-3 pr-3 pb-2">
            {isLoading ? (
              <div className="space-y-2 py-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-24 w-full rounded-lg" />
                ))}
              </div>
            ) : filteredDailyEvents.length === 0 ? (
              <EmptyState icon={Calendar} message={t('events.noEventsToday')} />
            ) : (
              <>
                {exactEvents.length > 0 && (
                  <section className="space-y-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase">{t('events.todayExact')}</h3>
                    {exactEvents.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        onGoTo={event.ra !== undefined ? handleGoTo : undefined}
                        onClick={() => setSelectedEvent(event)}
                      />
                    ))}
                  </section>
                )}
                {ongoingEvents.length > 0 && (
                  <section className="space-y-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase">{t('events.todayOngoing')}</h3>
                    {ongoingEvents.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        onGoTo={event.ra !== undefined ? handleGoTo : undefined}
                        onClick={() => setSelectedEvent(event)}
                      />
                    ))}
                  </section>
                )}
              </>
            )}

            <Separator className="my-3" />
            <Collapsible open={showMonthOverview} onOpenChange={setShowMonthOverview}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-start text-xs">{t('events.monthOverview')}</Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1">
                {monthEvents.slice(0, 12).map((event) => (
                  <div key={`month-${event.id}`} className="text-xs text-muted-foreground flex items-center justify-between">
                    <span className="truncate">{event.name}</span>
                    <span>{event.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          </div>
        </ScrollArea>

        <div className="shrink-0 pt-2 border-t flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <MapPin className="h-3 w-3" />
            <span>{observer.latitude.toFixed(2)}°, {observer.longitude.toFixed(2)}°</span>
          </div>
          <span>{filteredDailyEvents.length} {t('events.eventsFound')}</span>
        </div>
      </DialogContent>

      <EventDetailDialog
        event={selectedEvent}
        open={selectedEvent !== null}
        onOpenChange={(isOpen) => { if (!isOpen) setSelectedEvent(null); }}
        onGoTo={handleGoTo}
      />
    </Dialog>
  );
}
