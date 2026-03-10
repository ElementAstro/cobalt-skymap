'use client';

import { useTranslations } from 'next-intl';
import {
  Gauge,
  Zap,
  Monitor,
  Star,
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { RenderQuality } from '@/lib/stores/settings-store';
import { usePerformanceDraftModel } from '@/lib/hooks/use-settings-draft';
import { SettingsSection, ToggleItem } from './settings-shared';

export function PerformanceSettings() {
  const t = useTranslations();
  
  const { performance, setPerformanceSetting } = usePerformanceDraftModel();

  const getQualityDescription = (quality: RenderQuality) => {
    switch (quality) {
      case 'low':
        return t('settingsNew.performance.qualityLowDesc');
      case 'medium':
        return t('settingsNew.performance.qualityMediumDesc');
      case 'high':
        return t('settingsNew.performance.qualityHighDesc');
      case 'ultra':
        return t('settingsNew.performance.qualityUltraDesc');
    }
  };

  return (
    <div className="space-y-4">
      {/* Render Quality */}
      <SettingsSection
        title={t('settingsNew.performance.renderQuality')}
        icon={<Monitor className="h-4 w-4" />}
        defaultOpen={true}
      >
        <div className="space-y-3">
          <Select
            value={performance.renderQuality}
            onValueChange={(v) => setPerformanceSetting('renderQuality', v as RenderQuality)}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">{t('settingsNew.performance.qualityLow')}</SelectItem>
              <SelectItem value="medium">{t('settingsNew.performance.qualityMedium')}</SelectItem>
              <SelectItem value="high">{t('settingsNew.performance.qualityHigh')}</SelectItem>
              <SelectItem value="ultra">{t('settingsNew.performance.qualityUltra')}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {getQualityDescription(performance.renderQuality)}
          </p>
        </div>
      </SettingsSection>

      <Separator />

      {/* Star Rendering */}
      <SettingsSection
        title={t('settingsNew.performance.starRendering')}
        icon={<Star className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm">{t('settingsNew.performance.maxStars')}</Label>
            <Badge variant="outline" className="font-mono">
              {performance.maxStarsRendered.toLocaleString()}
            </Badge>
          </div>
          <Slider
            value={[performance.maxStarsRendered]}
            onValueChange={([v]) => setPerformanceSetting('maxStarsRendered', v)}
            min={10000}
            max={100000}
            step={5000}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>10,000</span>
            <span>100,000</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('settingsNew.performance.maxStarsDesc')}
          </p>
        </div>
      </SettingsSection>

      <Separator />

      {/* Graphics Options */}
      <SettingsSection
        title={t('settingsNew.performance.graphics')}
        icon={<Gauge className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="space-y-2">
          <ToggleItem
            id="enable-antialiasing"
            label={t('settingsNew.performance.antialiasing')}
            description={t('settingsNew.performance.antialiasingDesc')}
            checked={performance.enableAntialiasing}
            onCheckedChange={(checked) => setPerformanceSetting('enableAntialiasing', checked)}
          />
          <ToggleItem
            id="show-fps"
            label={t('settingsNew.performance.showFPS')}
            description={t('settingsNew.performance.showFPSDesc')}
            checked={performance.showFPS}
            onCheckedChange={(checked) => setPerformanceSetting('showFPS', checked)}
          />
        </div>
      </SettingsSection>

      <Separator />

      {/* Animation Settings */}
      <SettingsSection
        title={t('settingsNew.performance.animations')}
        icon={<Zap className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="space-y-2">
          <ToggleItem
            id="enable-animations"
            label={t('settingsNew.performance.enableAnimations')}
            description={t('settingsNew.performance.enableAnimationsDesc')}
            checked={performance.enableAnimations}
            onCheckedChange={(checked) => setPerformanceSetting('enableAnimations', checked)}
          />
          <ToggleItem
            id="reduced-motion"
            label={t('settingsNew.performance.reducedMotion')}
            description={t('settingsNew.performance.reducedMotionDesc')}
            checked={performance.reducedMotion}
            onCheckedChange={(checked) => setPerformanceSetting('reducedMotion', checked)}
          />
        </div>
      </SettingsSection>
    </div>
  );
}
