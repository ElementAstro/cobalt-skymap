'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import {
  Calculator,
  MapPin,
} from 'lucide-react';
import { useMountStore, useStellariumStore } from '@/lib/stores';
import { useTargetListStore } from '@/lib/stores/target-list-store';
import { degreesToHMS, degreesToDMS } from '@/lib/astronomy/starmap-utils';
import {
  PositionsTab,
  WUTTab,
  RTSTab,
  EphemerisTab,
  AlmanacTab,
  PhenomenaTab,
  CoordinateTab,
  TimeTab,
  SolarSystemTab,
} from './astro-calculator';

// ============================================================================
// Main Component
// ============================================================================

export function AstroCalculatorDialog() {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('wut');

  const profileInfo = useMountStore((state) => state.profileInfo);
  const setViewDirection = useStellariumStore((state) => state.setViewDirection);
  const addTarget = useTargetListStore((state) => state.addTarget);

  const latitude = profileInfo.AstrometrySettings.Latitude || 0;
  const longitude = profileInfo.AstrometrySettings.Longitude || 0;

  const handleSelectObject = useCallback((ra: number, dec: number) => {
    if (setViewDirection) {
      setViewDirection(ra, dec);
    }
  }, [setViewDirection]);

  const handleAddToList = useCallback((name: string, ra: number, dec: number) => {
    addTarget({
      name,
      ra,
      dec,
      raString: degreesToHMS(ra),
      decString: degreesToDMS(dec),
      priority: 'medium',
    });
  }, [addTarget]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Calculator className="h-4 w-4" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('astroCalc.title')}</p>
        </TooltipContent>
      </Tooltip>

      <DialogContent className="max-w-4xl max-h-[90vh] max-h-[90dvh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              {t('astroCalc.title')}
            </div>
            <Badge variant="outline" className="font-normal text-xs gap-1.5">
              <MapPin className="h-3 w-3" />
              {latitude.toFixed(2)}°, {longitude.toFixed(2)}°
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden min-h-0">
          <TabsList className="grid w-full grid-cols-3 grid-rows-3 h-auto gap-0.5 p-1">
            <TabsTrigger value="wut" className="text-xs">
              {t('astroCalc.wut')}
            </TabsTrigger>
            <TabsTrigger value="positions" className="text-xs">
              {t('astroCalc.positions')}
            </TabsTrigger>
            <TabsTrigger value="rts" className="text-xs">
              {t('astroCalc.rts')}
            </TabsTrigger>
            <TabsTrigger value="ephemeris" className="text-xs">
              {t('astroCalc.ephemeris')}
            </TabsTrigger>
            <TabsTrigger value="almanac" className="text-xs">
              {t('astroCalc.almanac')}
            </TabsTrigger>
            <TabsTrigger value="phenomena" className="text-xs">
              {t('astroCalc.phenomena')}
            </TabsTrigger>
            <TabsTrigger value="coordinate" className="text-xs">
              {t('astroCalc.coordinate')}
            </TabsTrigger>
            <TabsTrigger value="time" className="text-xs">
              {t('astroCalc.timeCalc')}
            </TabsTrigger>
            <TabsTrigger value="solar-system" className="text-xs">
              {t('astroCalc.solarSystem')}
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto mt-4">
            <TabsContent value="wut" className="mt-0 h-full">
              <WUTTab
                latitude={latitude}
                longitude={longitude}
                onSelectObject={handleSelectObject}
                onAddToList={handleAddToList}
              />
            </TabsContent>

            <TabsContent value="positions" className="mt-0 h-full">
              <PositionsTab
                latitude={latitude}
                longitude={longitude}
                onSelectObject={handleSelectObject}
                onAddToList={handleAddToList}
              />
            </TabsContent>

            <TabsContent value="rts" className="mt-0 h-full">
              <RTSTab latitude={latitude} longitude={longitude} />
            </TabsContent>

            <TabsContent value="ephemeris" className="mt-0 h-full">
              <EphemerisTab latitude={latitude} longitude={longitude} />
            </TabsContent>

            <TabsContent value="almanac" className="mt-0 h-full">
              <AlmanacTab latitude={latitude} longitude={longitude} />
            </TabsContent>

            <TabsContent value="phenomena" className="mt-0 h-full">
              <PhenomenaTab latitude={latitude} longitude={longitude} />
            </TabsContent>

            <TabsContent value="coordinate" className="mt-0 h-full">
              <CoordinateTab latitude={latitude} longitude={longitude} />
            </TabsContent>

            <TabsContent value="time" className="mt-0 h-full">
              <TimeTab longitude={longitude} />
            </TabsContent>

            <TabsContent value="solar-system" className="mt-0 h-full">
              <SolarSystemTab latitude={latitude} longitude={longitude} />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
