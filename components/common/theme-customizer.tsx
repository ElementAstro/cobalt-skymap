'use client';

import { useState } from 'react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { 
  Palette, 
  RotateCcw, 
  Check, 
  Type, 
  Circle,
  Sparkles,
  Sun,
  Moon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  useThemeStore, 
  themePresets,
  getFontPreview,
  type ThemeCustomization,
} from '@/lib/stores/theme-store';
import { cn } from '@/lib/utils';

interface ThemeCustomizerProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ThemeCustomizer({ trigger, open, onOpenChange }: ThemeCustomizerProps) {
  const t = useTranslations();
  const { resolvedTheme } = useTheme();
  const [internalOpen, setInternalOpen] = useState(false);
  
  const isOpen = open ?? internalOpen;
  const setIsOpen = onOpenChange ?? setInternalOpen;

  const {
    customization,
    setRadius,
    setFontFamily,
    setFontSize,
    setAnimationsEnabled,
    setActivePreset,
    resetCustomization,
  } = useThemeStore();

  const defaultTrigger = (
    <Button variant="outline" size="sm" className="gap-2">
      <Palette className="h-4 w-4" />
      {t('theme.customize')}
    </Button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger ?? defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] max-h-[85dvh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            {t('theme.customizeTheme')}
          </DialogTitle>
          <DialogDescription>
            {t('theme.customizeDescription')}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] max-h-[60dvh] pr-4">
          <Tabs defaultValue="presets" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="presets" className="gap-1">
                <Sparkles className="h-3 w-3" />
                {t('theme.presets')}
              </TabsTrigger>
              <TabsTrigger value="appearance" className="gap-1">
                <Circle className="h-3 w-3" />
                {t('theme.appearance')}
              </TabsTrigger>
              <TabsTrigger value="typography" className="gap-1">
                <Type className="h-3 w-3" />
                {t('theme.typography')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="presets" className="space-y-4 mt-4">
              <div className="space-y-3">
                <Label>{t('theme.colorPresets')}</Label>
                <div className="grid grid-cols-2 gap-3">
                  {themePresets.map((preset) => {
                    const colors = resolvedTheme === 'dark' ? preset.colors.dark : preset.colors.light;
                    const isActive = customization.activePreset === preset.id;
                    
                    return (
                      <button
                        key={preset.id}
                        onClick={() => setActivePreset(isActive ? null : preset.id)}
                        className={cn(
                          'relative flex flex-col items-start gap-2 rounded-lg border-2 p-3 transition-all hover:bg-accent/50',
                          isActive ? 'border-primary bg-accent/30' : 'border-border'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex -space-x-1">
                            <div 
                              className="h-4 w-4 rounded-full border border-background" 
                              style={{ background: colors.primary }}
                            />
                            <div 
                              className="h-4 w-4 rounded-full border border-background" 
                              style={{ background: colors.secondary }}
                            />
                            <div 
                              className="h-4 w-4 rounded-full border border-background" 
                              style={{ background: colors.accent }}
                            />
                          </div>
                          <span className="text-sm font-medium">{preset.name}</span>
                        </div>
                        {isActive && (
                          <div className="absolute right-2 top-2">
                            <Check className="h-4 w-4 text-primary" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              
              <Separator />
              
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                {resolvedTheme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                {resolvedTheme === 'dark' ? t('common.darkMode') : t('common.lightMode')}
              </div>
            </TabsContent>

            <TabsContent value="appearance" className="space-y-6 mt-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>{t('theme.borderRadius')}</Label>
                  <span className="text-sm text-muted-foreground">
                    {customization.radius.toFixed(2)}rem
                  </span>
                </div>
                <Slider
                  value={[customization.radius]}
                  onValueChange={([value]) => setRadius(value)}
                  min={0}
                  max={1}
                  step={0.05}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{t('theme.square')}</span>
                  <span>{t('theme.rounded')}</span>
                </div>
                <div className="flex gap-2 pt-2">
                  <div 
                    className="h-12 w-12 bg-primary" 
                    style={{ borderRadius: `${customization.radius}rem` }}
                  />
                  <div 
                    className="h-12 flex-1 bg-muted border-2 border-border flex items-center justify-center text-xs"
                    style={{ borderRadius: `${customization.radius}rem` }}
                  >
                    {t('theme.preview')}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t('theme.animations')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t('theme.animationsDescription')}
                  </p>
                </div>
                <Switch
                  checked={customization.animationsEnabled}
                  onCheckedChange={setAnimationsEnabled}
                />
              </div>
            </TabsContent>

            <TabsContent value="typography" className="space-y-6 mt-4">
              <div className="space-y-3">
                <Label>{t('theme.fontFamily')}</Label>
                <Select
                  value={customization.fontFamily}
                  onValueChange={(value) => setFontFamily(value as ThemeCustomization['fontFamily'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">{t('theme.fontDefault')}</SelectItem>
                    <SelectItem value="serif">{t('theme.fontSerif')}</SelectItem>
                    <SelectItem value="mono">{t('theme.fontMono')}</SelectItem>
                    <SelectItem value="system">{t('theme.fontSystem')}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground" style={{ fontFamily: getFontPreview(customization.fontFamily) }}>
                  {t('theme.fontPreviewText')}
                </p>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label>{t('theme.fontSize')}</Label>
                <Select
                  value={customization.fontSize}
                  onValueChange={(value) => setFontSize(value as ThemeCustomization['fontSize'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">{t('theme.fontSizeSmall')}</SelectItem>
                    <SelectItem value="default">{t('theme.fontSizeDefault')}</SelectItem>
                    <SelectItem value="large">{t('theme.fontSizeLarge')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
          </Tabs>
        </ScrollArea>

        <Separator className="my-2" />

        <div className="flex justify-between">
          <Button 
            variant="outline" 
            size="sm"
            onClick={resetCustomization}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            {t('common.reset')}
          </Button>
          <Button size="sm" onClick={() => setIsOpen(false)}>
            {t('common.close')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ThemeCustomizerButton() {
  const t = useTranslations();
  
  return (
    <ThemeCustomizer
      trigger={
        <Button variant="ghost" size="icon" className="h-10 w-10">
          <Palette className="h-5 w-5" />
          <span className="sr-only">{t('theme.customize')}</span>
        </Button>
      }
    />
  );
}
