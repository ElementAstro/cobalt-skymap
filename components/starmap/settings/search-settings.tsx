'use client';

import { useTranslations } from 'next-intl';
import {
  Search,
  Clock,
  History,
  ListFilter,
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useSearchDraftModel } from '@/lib/hooks/use-settings-draft';
import { SettingsSection, ToggleItem } from './settings-shared';

export function SearchBehaviorSettings() {
  const t = useTranslations();
  
  const { search, setSearchSetting } = useSearchDraftModel();

  return (
    <div className="space-y-4">
      {/* Search Behavior */}
      <SettingsSection
        title={t('settingsNew.search.behavior')}
        icon={<Search className="h-4 w-4" />}
        defaultOpen={true}
      >
        <div className="space-y-2">
          <ToggleItem
            id="enable-fuzzy-search"
            label={t('settingsNew.search.fuzzySearch')}
            description={t('settingsNew.search.fuzzySearchDesc')}
            checked={search.enableFuzzySearch}
            onCheckedChange={(checked) => setSearchSetting('enableFuzzySearch', checked)}
          />
          <ToggleItem
            id="include-minor-objects"
            label={t('settingsNew.search.includeMinorObjects')}
            description={t('settingsNew.search.includeMinorObjectsDesc')}
            checked={search.includeMinorObjects}
            onCheckedChange={(checked) => setSearchSetting('includeMinorObjects', checked)}
          />
        </div>
      </SettingsSection>

      <Separator />

      {/* Timing & Results */}
      <SettingsSection
        title={t('settingsNew.search.resultsAndTiming')}
        icon={<ListFilter className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                {t('settingsNew.search.autoSearchDelay')}
              </Label>
              <Badge variant="outline" className="font-mono">
                {search.autoSearchDelay}ms
              </Badge>
            </div>
            <Slider
              value={[search.autoSearchDelay]}
              onValueChange={([v]) => setSearchSetting('autoSearchDelay', v)}
              min={100}
              max={1000}
              step={50}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t('settingsNew.search.faster')}</span>
              <span>{t('settingsNew.search.slower')}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('settingsNew.search.autoSearchDelayDesc')}
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">{t('settingsNew.search.maxResults')}</Label>
              <Badge variant="outline" className="font-mono">
                {search.maxSearchResults}
              </Badge>
            </div>
            <Slider
              value={[search.maxSearchResults]}
              onValueChange={([v]) => setSearchSetting('maxSearchResults', v)}
              min={10}
              max={200}
              step={10}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>10</span>
              <span>200</span>
            </div>
          </div>
        </div>
      </SettingsSection>

      <Separator />

      {/* Search History */}
      <SettingsSection
        title={t('settingsNew.search.history')}
        icon={<History className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="space-y-3">
          <ToggleItem
            id="remember-search-history"
            label={t('settingsNew.search.rememberHistory')}
            description={t('settingsNew.search.rememberHistoryDesc')}
            checked={search.rememberSearchHistory}
            onCheckedChange={(checked) => setSearchSetting('rememberSearchHistory', checked)}
          />

          {search.rememberSearchHistory && (
            <div className="space-y-3 pl-1">
              <div className="flex items-center justify-between">
                <Label className="text-sm">{t('settingsNew.search.maxHistoryItems')}</Label>
                <Badge variant="outline" className="font-mono">
                  {search.maxHistoryItems}
                </Badge>
              </div>
              <Slider
                value={[search.maxHistoryItems]}
                onValueChange={([v]) => setSearchSetting('maxHistoryItems', v)}
                min={5}
                max={100}
                step={5}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>5</span>
                <span>100</span>
              </div>
            </div>
          )}
        </div>
      </SettingsSection>
    </div>
  );
}
