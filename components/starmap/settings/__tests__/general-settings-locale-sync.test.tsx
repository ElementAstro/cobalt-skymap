/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

const mockSetPreference = jest.fn();
const settingsDraftModel = {
  preferences: {
    locale: 'en' as const,
    timeFormat: '24h' as const,
    dateFormat: 'iso' as const,
    coordinateFormat: 'dms' as const,
    distanceUnit: 'metric' as const,
    temperatureUnit: 'celsius' as const,
    startupView: 'last' as const,
    showSplash: true,
    autoConnectBackend: true,
    dailyKnowledgeEnabled: true,
    dailyKnowledgeAutoShow: true,
    dailyKnowledgeOnlineEnhancement: true,
    skipCloseConfirmation: false,
  },
  setPreference: mockSetPreference,
};

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/lib/stores', () => ({
  useDailyKnowledgeStore: (selector: (state: { openDialog: jest.Mock }) => unknown) =>
    selector({ openDialog: jest.fn() }),
}));

jest.mock('@/lib/hooks/use-settings-draft', () => ({
  usePreferencesDraftModel: () => settingsDraftModel,
}));

jest.mock('@/components/starmap/settings/settings-shared', () => ({
  SettingsSection: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ToggleItem: () => <div data-testid="toggle-item" />,
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
  }) => (
    <div>
      <button type="button" data-testid={`select-${value}`} onClick={() => onValueChange?.('zh')}>
        select-{value}
      </button>
      {children}
    </div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span>value</span>,
}));

import { GeneralSettings } from '../general-settings';

describe('GeneralSettings locale linkage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates only the draft locale when language changes', () => {
    render(<GeneralSettings />);

    fireEvent.click(screen.getByTestId('select-en'));

    expect(mockSetPreference).toHaveBeenCalledWith('locale', 'zh');
  });
});
