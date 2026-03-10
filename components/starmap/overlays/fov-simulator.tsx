'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Camera,
  Ruler,
  Focus,
  Grid3X3,
  LayoutGrid,
  RotateCw,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Settings2,
  Layers,
  ZoomIn,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { useEquipmentStore } from '@/lib/stores';
import {
  SENSOR_PRESETS,
  TELESCOPE_PRESETS,
  GRID_OPTIONS,
  type SensorPreset,
  type TelescopePreset,
  type GridType,
} from '@/lib/constants/equipment-presets';
import { NumberStepper } from '@/components/ui/number-stepper';
import { SwitchItem } from '@/components/ui/switch-item';
import { EmptyState } from '@/components/ui/empty-state';
import { ColorPicker } from '@/components/ui/color-picker';
import type { FOVSimulatorProps } from '@/types/starmap/overlays';
import {
  calculateCameraFov,
  calculateImageScale,
  calculateSensorResolution,
  calculateMosaicCoverage,
} from '@/lib/astronomy/fov-calculations';

// Re-export types for backward compatibility
export type { MosaicSettings } from '@/lib/stores';
export type { GridType } from '@/lib/constants/equipment-presets';


// ============================================================================
// Main Component
// ============================================================================

export function FOVSimulator({
  enabled,
  onEnabledChange,
  sensorWidth,
  sensorHeight,
  focalLength,
  pixelSize = 3.76,
  rotationAngle = 0,
  onSensorWidthChange,
  onSensorHeightChange,
  onFocalLengthChange,
  onPixelSizeChange,
  onRotationAngleChange,
  mosaic,
  onMosaicChange,
  gridType,
  onGridTypeChange,
}: FOVSimulatorProps) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [localPixelSize, setLocalPixelSize] = useState(pixelSize);
  const [localRotation, setLocalRotation] = useState(rotationAngle);
  
  // Display options from equipment store (persistent, shared with FOVOverlay)
  const fovDisplay = useEquipmentStore((s) => s.fovDisplay);
  const setFOVDisplay = useEquipmentStore((s) => s.setFOVDisplay);
  const { overlayOpacity, frameColor, frameStyle, showCoordinateGrid, showConstellations, showConstellationBoundaries, showDSOLabels, rotateSky, preserveAlignment, dragToPosition } = fovDisplay;

  // Calculations — delegated to pure utility functions
  const { width: fovWidth, height: fovHeight } = useMemo(() =>
    calculateCameraFov(sensorWidth, sensorHeight, focalLength),
    [sensorWidth, sensorHeight, focalLength]
  );

  const imageScale = useMemo(() =>
    calculateImageScale(localPixelSize, focalLength),
    [localPixelSize, focalLength]
  );

  const resolution = useMemo(() =>
    calculateSensorResolution(sensorWidth, sensorHeight, localPixelSize),
    [sensorWidth, sensorHeight, localPixelSize]
  );

  const mosaicCoverage = useMemo(() =>
    calculateMosaicCoverage(fovWidth, fovHeight, mosaic, resolution),
    [mosaic, fovWidth, fovHeight, resolution]
  );

  const applyPreset = useCallback((preset: SensorPreset) => {
    onSensorWidthChange(preset.width);
    onSensorHeightChange(preset.height);
    if (preset.pixelSize && onPixelSizeChange) {
      onPixelSizeChange(preset.pixelSize);
      setLocalPixelSize(preset.pixelSize);
    }
  }, [onSensorWidthChange, onSensorHeightChange, onPixelSizeChange]);

  const applyTelescopePreset = useCallback((preset: TelescopePreset) => {
    onFocalLengthChange(preset.focalLength);
  }, [onFocalLengthChange]);

  const handleCopy = useCallback(() => {
    const text = [
      `FOV: ${fovWidth.toFixed(2)}° × ${fovHeight.toFixed(2)}°`,
      `Sensor: ${sensorWidth}mm × ${sensorHeight}mm`,
      `Focal Length: ${focalLength}mm`,
      `Image Scale: ${imageScale.toFixed(2)}"/px`,
      `Resolution: ${resolution.width} × ${resolution.height}`,
      mosaic.enabled ? `Mosaic: ${mosaic.cols}×${mosaic.rows} (${mosaicCoverage?.width.toFixed(2)}° × ${mosaicCoverage?.height.toFixed(2)}°)` : '',
    ].filter(Boolean).join('\n');
    
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [fovWidth, fovHeight, sensorWidth, sensorHeight, focalLength, imageScale, resolution, mosaic, mosaicCoverage]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('fov.simulator')}
              className={cn(
                'h-9 w-9 touch-target toolbar-btn',
                enabled 
                  ? 'bg-primary/30 text-primary' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              <Camera className="h-5 w-5" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>{t('fov.fovSimulator')}</p>
        </TooltipContent>
      </Tooltip>

      <DialogContent className="w-[95vw] max-w-[640px] max-h-[85vh] max-h-[85dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              {t('fov.fovSimulator')}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleCopy}
              >
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Switch checked={enabled} onCheckedChange={onEnabledChange} />
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="camera" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="camera" className="text-xs">
              <Camera className="h-3.5 w-3.5 mr-1.5" />
              {t('fov.cameraTab')}
            </TabsTrigger>
            <TabsTrigger value="optics" className="text-xs">
              <Focus className="h-3.5 w-3.5 mr-1.5" />
              {t('fov.opticsTab')}
            </TabsTrigger>
            <TabsTrigger value="mosaic" className="text-xs">
              <Grid3X3 className="h-3.5 w-3.5 mr-1.5" />
              {t('fov.mosaicTab')}
            </TabsTrigger>
            <TabsTrigger value="display" className="text-xs">
              <Layers className="h-3.5 w-3.5 mr-1.5" />
              {t('fov.displayTab')}
            </TabsTrigger>
          </TabsList>

          {/* Camera Tab */}
          <TabsContent value="camera" className="space-y-4 pt-4">
            {/* Sensor Presets */}
            <div className="space-y-2">
              <Label>{t('fov.sensorPreset')}</Label>
              <Tabs defaultValue="zwo" className="w-full">
                <TabsList className="grid w-full grid-cols-5 h-8">
                  <TabsTrigger value="fullFrame" className="text-[10px] px-1">Full Frame</TabsTrigger>
                  <TabsTrigger value="apsc" className="text-[10px] px-1">APS-C</TabsTrigger>
                  <TabsTrigger value="zwo" className="text-[10px] px-1">ZWO</TabsTrigger>
                  <TabsTrigger value="qhy" className="text-[10px] px-1">QHY</TabsTrigger>
                  <TabsTrigger value="other" className="text-[10px] px-1">Other</TabsTrigger>
                </TabsList>
                {Object.entries(SENSOR_PRESETS).map(([key, presets]) => (
                  <TabsContent key={key} value={key} className="mt-2">
                    <ScrollArea className="h-32">
                      <div className="grid grid-cols-2 gap-1 pr-2">
                        {presets.map((preset) => (
                          <Button
                            key={preset.name}
                            variant="outline"
                            size="sm"
                            className={cn(
                              'text-xs h-auto py-1.5 px-2 justify-start flex-col items-start',
                              sensorWidth === preset.width && sensorHeight === preset.height
                                ? 'bg-primary/20 border-primary text-primary'
                                : ''
                            )}
                            onClick={() => applyPreset(preset)}
                          >
                            <span className="font-medium truncate w-full text-left">{preset.name}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {preset.width}×{preset.height}mm
                              {preset.pixelSize && ` | ${preset.pixelSize}μm`}
                            </span>
                          </Button>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                ))}
              </Tabs>
            </div>

            <Separator />

            {/* Manual Sensor Input */}
            <div className="space-y-3">
              <Label className="text-sm">{t('fov.manualInput')}</Label>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t('fov.sensorWidth')} (mm)</Label>
                  <Input
                    type="number"
                    value={sensorWidth}
                    onChange={(e) => onSensorWidthChange(parseFloat(e.target.value) || 0)}
                    className="h-8"
                    step="0.1"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t('fov.sensorHeight')} (mm)</Label>
                  <Input
                    type="number"
                    value={sensorHeight}
                    onChange={(e) => onSensorHeightChange(parseFloat(e.target.value) || 0)}
                    className="h-8"
                    step="0.1"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t('fov.pixelSize')} (μm)</Label>
                  <Input
                    type="number"
                    value={localPixelSize}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 1;
                      setLocalPixelSize(v);
                      onPixelSizeChange?.(v);
                    }}
                    className="h-8"
                    step="0.01"
                  />
                </div>
              </div>
            </div>

            {/* Rotation */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-sm">
                  <RotateCw className="h-4 w-4" />
                  {t('fov.rotation')}
                </Label>
                <span className="text-xs text-muted-foreground font-mono">{localRotation.toFixed(1)}°</span>
              </div>
              <div className="flex gap-2">
                <Slider
                  value={[localRotation]}
                  onValueChange={([v]) => {
                    setLocalRotation(v);
                    onRotationAngleChange?.(v);
                  }}
                  min={-180}
                  max={180}
                  step={0.5}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => {
                    setLocalRotation(0);
                    onRotationAngleChange?.(0);
                  }}
                >
                  Reset
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Optics Tab */}
          <TabsContent value="optics" className="space-y-4 pt-4">
            {/* Telescope Presets */}
            <div className="space-y-2">
              <Label>{t('fov.telescopePreset')}</Label>
              <ScrollArea className="h-40">
                <div className="grid grid-cols-2 gap-1 pr-2">
                  {TELESCOPE_PRESETS.map((preset) => (
                    <Button
                      key={preset.name}
                      variant="outline"
                      size="sm"
                      className={cn(
                        'text-xs h-auto py-1.5 px-2 justify-start flex-col items-start',
                        focalLength === preset.focalLength ? 'bg-primary/20 border-primary' : ''
                      )}
                      onClick={() => applyTelescopePreset(preset)}
                    >
                      <span className="font-medium truncate w-full text-left">{preset.name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {preset.focalLength}mm | f/{(preset.focalLength / preset.aperture).toFixed(1)} | {preset.type}
                      </span>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <Separator />

            {/* Manual Focal Length */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Ruler className="h-4 w-4" />
                {t('fov.focalLength')} (mm)
              </Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={focalLength}
                  onChange={(e) => onFocalLengthChange(parseFloat(e.target.value) || 0)}
                  className="h-9"
                  step="1"
                />
                <div className="flex gap-1">
                  {[200, 400, 600, 1000, 2000].map((fl) => (
                    <Button
                      key={fl}
                      variant={focalLength === fl ? 'default' : 'outline'}
                      size="sm"
                      className="h-9 px-2 text-xs"
                      onClick={() => onFocalLengthChange(fl)}
                    >
                      {fl}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Calculated Results */}
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ZoomIn className="h-4 w-4" />
                  {t('fov.calculatedFOV')}
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2 px-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">{t('fov.fieldWidth')}</span>
                    <p className="font-mono font-medium">
                      {fovWidth.toFixed(2)}° <span className="text-muted-foreground">({(fovWidth * 60).toFixed(1)}&apos;)</span>
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">{t('fov.fieldHeight')}</span>
                    <p className="font-mono font-medium">
                      {fovHeight.toFixed(2)}° <span className="text-muted-foreground">({(fovHeight * 60).toFixed(1)}&apos;)</span>
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">{t('fov.imageScale')}</span>
                    <p className="font-mono font-medium">{imageScale.toFixed(2)} &quot;/px</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">{t('fov.resolution')}</span>
                    <p className="font-mono font-medium">{resolution.width} × {resolution.height}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Mosaic Tab */}
          <TabsContent value="mosaic" className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Grid3X3 className="h-4 w-4" />
                {t('fov.enableMosaic')}
              </Label>
              <Switch
                checked={mosaic.enabled}
                onCheckedChange={(checked) => onMosaicChange({ ...mosaic, enabled: checked })}
              />
            </div>

            {mosaic.enabled && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <NumberStepper
                    value={mosaic.cols}
                    onChange={(v) => onMosaicChange({ ...mosaic, cols: v })}
                    min={1}
                    max={10}
                    label={t('fov.columns')}
                  />
                  <NumberStepper
                    value={mosaic.rows}
                    onChange={(v) => onMosaicChange({ ...mosaic, rows: v })}
                    min={1}
                    max={10}
                    label={t('fov.rows')}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">{t('fov.overlap')}</Label>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono">
                        {mosaic.overlap}{mosaic.overlapUnit === 'percent' ? '%' : 'px'}
                      </Badge>
                      <Select
                        value={mosaic.overlapUnit}
                        onValueChange={(v: 'percent' | 'pixels') => onMosaicChange({ ...mosaic, overlapUnit: v })}
                      >
                        <SelectTrigger className="h-7 w-16">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percent">%</SelectItem>
                          <SelectItem value="pixels">px</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Slider
                    value={[mosaic.overlap]}
                    onValueChange={([v]) => onMosaicChange({ ...mosaic, overlap: v })}
                    min={0}
                    max={mosaic.overlapUnit === 'percent' ? 50 : 500}
                    step={mosaic.overlapUnit === 'percent' ? 5 : 50}
                    className="w-full"
                  />
                </div>

                {/* Mosaic Summary */}
                {mosaicCoverage && (
                  <Card className="border-primary/30 bg-primary/5">
                    <CardContent className="py-3 px-3">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-xs text-muted-foreground">{t('fov.totalPanels')}</span>
                          <p className="font-mono font-medium">{mosaicCoverage.totalPanels}</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">{t('fov.totalCoverage')}</span>
                          <p className="font-mono font-medium text-primary">
                            {mosaicCoverage.width.toFixed(2)}° × {mosaicCoverage.height.toFixed(2)}°
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {!mosaic.enabled && (
              <EmptyState icon={Grid3X3} message={t('fov.mosaicDisabled')} iconClassName="h-12 w-12 opacity-30" />
            )}
          </TabsContent>

          {/* Display Tab */}
          <TabsContent value="display" className="space-y-4 pt-4">
            {/* Grid Type */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4" />
                {t('fov.compositionGrid')}
              </Label>
              <ToggleGroup 
                type="single" 
                value={gridType} 
                onValueChange={(value) => value && onGridTypeChange(value as GridType)}
                className="grid grid-cols-5 gap-1"
              >
                {GRID_OPTIONS.map((option) => (
                  <ToggleGroupItem
                    key={option.value}
                    value={option.value}
                    className="h-12 flex-col gap-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                  >
                    <span className="text-lg font-mono">{option.icon}</span>
                    <span className="text-[10px]">{option.label}</span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <Separator />

            {/* Framing Assistant Options (NINA-style) */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">{t('fov.framingOptions')}</Label>
              <div className="space-y-2">
                <SwitchItem
                  label={t('fov.rotateSky')}
                  description={t('fov.rotateSkyDesc')}
                  checked={rotateSky}
                  onCheckedChange={(v) => setFOVDisplay({ rotateSky: v })}
                />
                <SwitchItem
                  label={t('fov.preserveAlignment')}
                  description={t('fov.preserveAlignmentDesc')}
                  checked={preserveAlignment}
                  onCheckedChange={(v) => setFOVDisplay({ preserveAlignment: v })}
                />
                <SwitchItem
                  label={t('fov.dragToPosition')}
                  description={t('fov.dragToPositionDesc')}
                  checked={dragToPosition}
                  onCheckedChange={(v) => setFOVDisplay({ dragToPosition: v })}
                />
              </div>
            </div>

            <Separator />

            {/* Advanced Options */}
            <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4" />
                    {t('fov.advancedOptions')}
                  </span>
                  {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-3">
                {/* Overlay Opacity */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">{t('fov.overlayOpacity')}</Label>
                    <span className="text-xs text-muted-foreground font-mono">{overlayOpacity}%</span>
                  </div>
                  <Slider
                    value={[overlayOpacity]}
                    onValueChange={([v]) => setFOVDisplay({ overlayOpacity: v })}
                    min={10}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>

                {/* Annotations */}
                <div className="space-y-3">
                  <Label className="text-sm">{t('fov.annotations')}</Label>
                  <div className="space-y-2">
                    <SwitchItem
                      label={t('fov.showCoordinateGrid')}
                      checked={showCoordinateGrid}
                      onCheckedChange={(v) => setFOVDisplay({ showCoordinateGrid: v })}
                    />
                    <SwitchItem
                      label={t('fov.showConstellations')}
                      checked={showConstellations}
                      onCheckedChange={(v) => setFOVDisplay({ showConstellations: v })}
                    />
                    <SwitchItem
                      label={t('fov.showConstellationBoundaries')}
                      checked={showConstellationBoundaries}
                      onCheckedChange={(v) => setFOVDisplay({ showConstellationBoundaries: v })}
                    />
                    <SwitchItem
                      label={t('fov.showDSOLabels')}
                      checked={showDSOLabels}
                      onCheckedChange={(v) => setFOVDisplay({ showDSOLabels: v })}
                    />
                  </div>
                </div>

                <Separator />

                {/* Frame Color */}
                <div className="space-y-2">
                  <Label className="text-sm">{t('fov.frameColor')}</Label>
                  <ColorPicker
                    colors={['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ffffff']}
                    value={frameColor}
                    onChange={(color) => setFOVDisplay({ frameColor: color })}
                  />
                </div>

                {/* Frame Style */}
                <div className="space-y-2">
                  <Label className="text-sm">{t('fov.frameStyle')}</Label>
                  <ToggleGroup 
                    type="single" 
                    value={frameStyle} 
                    onValueChange={(v) => v && setFOVDisplay({ frameStyle: v as 'solid' | 'dashed' | 'dotted' })}
                    className="flex gap-1"
                  >
                    <ToggleGroupItem value="solid" className="flex-1 h-8 text-xs">
                      {t('fov.styleSolid')}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="dashed" className="flex-1 h-8 text-xs">
                      {t('fov.styleDashed')}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="dotted" className="flex-1 h-8 text-xs">
                      {t('fov.styleDotted')}
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>

                <Separator />

                {/* Position Angle Display */}
                <div className="space-y-2">
                  <Label className="text-sm">{t('fov.positionAngle')}</Label>
                  <Card className="border-muted">
                    <CardContent className="py-2 px-3">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-xs text-muted-foreground">{t('fov.cameraAngle')}</span>
                          <p className="font-mono">{localRotation.toFixed(1)}°</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">{t('fov.dsoAngle')}</span>
                          <p className="font-mono">{(360 - localRotation).toFixed(1)}°</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
            {t('common.close')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

