'use client';

import { useTranslations } from 'next-intl';
import { Link } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useConnectionDraftModel } from '@/lib/hooks/use-settings-draft';
import { SettingsSection } from './settings-shared';

export function ConnectionSettings() {
  const t = useTranslations();
  const {
    connection,
    setConnection,
    backendProtocol,
    setBackendProtocol,
  } = useConnectionDraftModel();

  return (
    <SettingsSection
      title={t('settings.connection')}
      icon={<Link className="h-4 w-4" />}
      defaultOpen={false}
    >
      <div className="space-y-3">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">{t('settings.protocol')}</Label>
          <Select
            value={backendProtocol}
            onValueChange={(v) => setBackendProtocol(v as 'http' | 'https')}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="http">{t('settings.protocolHttp')}</SelectItem>
              <SelectItem value="https">{t('settings.protocolHttps')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('settings.ipAddress')}</Label>
            <Input
              value={connection.ip}
              onChange={(e) => setConnection({ ip: e.target.value })}
              onBlur={(e) => setConnection({ ip: e.target.value.trim() })}
              placeholder={t('settings.ipAddressPlaceholder')}
              className="h-8 text-sm font-mono"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('settings.port')}</Label>
            <Input
              type="number"
              min={1}
              max={65535}
              value={connection.port}
              onChange={(e) => {
                // Allow any input during typing, validate on blur
                setConnection({ port: e.target.value });
              }}
              onBlur={(e) => {
                // Validate and clamp port number on blur
                const port = parseInt(e.target.value);
                const validPort = isNaN(port) ? 1888 : Math.max(1, Math.min(65535, port));
                setConnection({ port: String(validPort) });
              }}
              placeholder={t('settings.portPlaceholder')}
              className="h-8 text-sm font-mono"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground px-1">
          {t('settings.connectionDescription')}
        </p>
      </div>
    </SettingsSection>
  );
}
