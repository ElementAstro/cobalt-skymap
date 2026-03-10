'use client';

import { useTranslations } from 'next-intl';
import {
  Bell,
  Volume2,
  MessageSquare,
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useNotificationDraftModel } from '@/lib/hooks/use-settings-draft';
import { SettingsSection, ToggleItem } from './settings-shared';

export function NotificationSettings() {
  const t = useTranslations();
  
  const { notifications, setNotificationSetting } = useNotificationDraftModel();

  return (
    <div className="space-y-4">
      {/* General Notifications */}
      <SettingsSection
        title={t('settingsNew.notifications.general')}
        icon={<Bell className="h-4 w-4" />}
        defaultOpen={true}
      >
        <div className="space-y-2">
          <ToggleItem
            id="enable-toasts"
            label={t('settingsNew.notifications.enableToasts')}
            description={t('settingsNew.notifications.enableToastsDesc')}
            checked={notifications.enableToasts}
            onCheckedChange={(checked) => setNotificationSetting('enableToasts', checked)}
          />
          <ToggleItem
            id="enable-sounds"
            label={t('settingsNew.notifications.enableSounds')}
            description={t('settingsNew.notifications.enableSoundsDesc')}
            checked={notifications.enableSounds}
            onCheckedChange={(checked) => setNotificationSetting('enableSounds', checked)}
          />
        </div>
      </SettingsSection>

      <Separator />

      {/* Toast Duration */}
      <SettingsSection
        title={t('settingsNew.notifications.duration')}
        icon={<MessageSquare className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm">{t('settingsNew.notifications.toastDuration')}</Label>
            <Badge variant="outline" className="font-mono">
              {(notifications.toastDuration / 1000).toFixed(1)}s
            </Badge>
          </div>
          <Slider
            value={[notifications.toastDuration]}
            onValueChange={([v]) => setNotificationSetting('toastDuration', v)}
            min={1000}
            max={10000}
            step={500}
            disabled={!notifications.enableToasts}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1s</span>
            <span>10s</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('settingsNew.notifications.toastDurationDesc')}
          </p>
        </div>
      </SettingsSection>

      <Separator />

      {/* Alert Types */}
      <SettingsSection
        title={t('settingsNew.notifications.alerts')}
        icon={<Volume2 className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="space-y-2">
          <ToggleItem
            id="show-object-alerts"
            label={t('settingsNew.notifications.objectAlerts')}
            description={t('settingsNew.notifications.objectAlertsDesc')}
            checked={notifications.showObjectAlerts}
            onCheckedChange={(checked) => setNotificationSetting('showObjectAlerts', checked)}
            icon="🌟"
          />
          <ToggleItem
            id="show-satellite-alerts"
            label={t('settingsNew.notifications.satelliteAlerts')}
            description={t('settingsNew.notifications.satelliteAlertsDesc')}
            checked={notifications.showSatelliteAlerts}
            onCheckedChange={(checked) => setNotificationSetting('showSatelliteAlerts', checked)}
            icon="🛰️"
          />
        </div>
      </SettingsSection>
    </div>
  );
}
