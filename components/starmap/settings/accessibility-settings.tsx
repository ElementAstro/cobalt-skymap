'use client';

import { useTranslations } from 'next-intl';
import {
  Accessibility,
  Eye,
  Type,
  Focus,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useAccessibilityDraftModel } from '@/lib/hooks/use-settings-draft';
import { SettingsSection, ToggleItem } from './settings-shared';

export function AccessibilitySettings() {
  const t = useTranslations();
  
  const { accessibility, setAccessibilitySetting } = useAccessibilityDraftModel();

  return (
    <div className="space-y-4">
      {/* Visual */}
      <SettingsSection
        title={t('settingsNew.accessibility.visual')}
        icon={<Eye className="h-4 w-4" />}
        defaultOpen={true}
      >
        <div className="space-y-2">
          <ToggleItem
            id="high-contrast"
            label={t('settingsNew.accessibility.highContrast')}
            description={t('settingsNew.accessibility.highContrastDesc')}
            checked={accessibility.highContrast}
            onCheckedChange={(checked) => setAccessibilitySetting('highContrast', checked)}
          />
          <ToggleItem
            id="reduce-transparency"
            label={t('settingsNew.accessibility.reduceTransparency')}
            description={t('settingsNew.accessibility.reduceTransparencyDesc')}
            checked={accessibility.reduceTransparency}
            onCheckedChange={(checked) => setAccessibilitySetting('reduceTransparency', checked)}
          />
        </div>
      </SettingsSection>

      <Separator />

      {/* Text */}
      <SettingsSection
        title={t('settingsNew.accessibility.text')}
        icon={<Type className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="space-y-2">
          <ToggleItem
            id="large-text"
            label={t('settingsNew.accessibility.largeText')}
            description={t('settingsNew.accessibility.largeTextDesc')}
            checked={accessibility.largeText}
            onCheckedChange={(checked) => setAccessibilitySetting('largeText', checked)}
          />
        </div>
      </SettingsSection>

      <Separator />

      {/* Navigation */}
      <SettingsSection
        title={t('settingsNew.accessibility.navigation')}
        icon={<Focus className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="space-y-2">
          <ToggleItem
            id="focus-indicators"
            label={t('settingsNew.accessibility.focusIndicators')}
            description={t('settingsNew.accessibility.focusIndicatorsDesc')}
            checked={accessibility.focusIndicators}
            onCheckedChange={(checked) => setAccessibilitySetting('focusIndicators', checked)}
          />
        </div>
      </SettingsSection>

      <Separator />

      {/* Screen Reader */}
      <SettingsSection
        title={t('settingsNew.accessibility.screenReader')}
        icon={<Accessibility className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="space-y-2">
          <ToggleItem
            id="screen-reader-optimized"
            label={t('settingsNew.accessibility.screenReaderOptimized')}
            description={t('settingsNew.accessibility.screenReaderOptimizedDesc')}
            checked={accessibility.screenReaderOptimized}
            onCheckedChange={(checked) => setAccessibilitySetting('screenReaderOptimized', checked)}
          />
        </div>
      </SettingsSection>
    </div>
  );
}
