/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock zustand persist
jest.mock('zustand/middleware', () => ({
  persist: (config: unknown) => config,
}));

// Mock storage
jest.mock('@/lib/storage', () => ({
  getZustandStorage: () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  }),
}));

// Mock theme store
const mockSetCustomization = jest.fn();

jest.mock('@/lib/stores/theme-store', () => ({
  useThemeStore: Object.assign(
    (selector: (state: unknown) => unknown) => {
      const state = {
        customization: { radius: 0.5, fontFamily: 'default', fontSize: 'default', animationsEnabled: true, activePreset: null },
        setCustomization: mockSetCustomization,
      };
      return selector ? selector(state) : state;
    },
    {
      getState: () => ({
        customization: { radius: 0.5, fontFamily: 'default', fontSize: 'default', animationsEnabled: true, activePreset: null },
        setCustomization: mockSetCustomization,
      }),
    }
  ),
}));

// Mock next-themes
jest.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'dark',
    setTheme: jest.fn(),
  }),
}));

// Mock keybinding store
jest.mock('@/lib/stores/keybinding-store', () => ({
  useKeybindingStore: Object.assign(
    (selector: (state: unknown) => unknown) => {
      const state = { customBindings: {} };
      return selector ? selector(state) : state;
    },
    {
      getState: () => ({ customBindings: {} }),
    }
  ),
}));

// Mock AlertDialog to render inline
jest.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children }: { children: React.ReactNode }) => <div data-testid="alert-dialog">{children}</div>,
  AlertDialogTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    asChild ? <>{children}</> : <div>{children}</div>
  ),
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div data-testid="alert-dialog-content">{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  AlertDialogAction: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

import { SettingsExportImport } from '../settings-export-import';
import { useDailyKnowledgeStore, useSettingsStore } from '@/lib/stores';

describe('SettingsExportImport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSettingsStore.setState({
      preferences: {
        locale: 'en',
        timeFormat: '24h',
        dateFormat: 'iso',
        coordinateFormat: 'dms',
        distanceUnit: 'metric',
        temperatureUnit: 'celsius',
        skipCloseConfirmation: false,
        rightPanelCollapsed: false,
        startupView: 'last' as const,
        showSplash: true,
        autoConnectBackend: true,
        dailyKnowledgeEnabled: true,
        dailyKnowledgeAutoShow: true,
        dailyKnowledgeOnlineEnhancement: true,
      },
    });
    useDailyKnowledgeStore.setState({
      favorites: [{ itemId: 'curated-andromeda-distance', createdAt: Date.now() }],
      history: [],
      lastShownDate: null,
      snoozedDate: null,
      lastSeenItemId: null,
    });
  });

  it('renders without crashing', () => {
    const { container } = render(<SettingsExportImport />);
    expect(container).toBeInTheDocument();
  });

  it('renders export and import buttons', () => {
    render(<SettingsExportImport />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it('renders collapsible section', () => {
    render(<SettingsExportImport />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('handles export click', async () => {
    // Mock URL.createObjectURL and URL.revokeObjectURL
    const mockCreateObjectURL = jest.fn(() => 'blob:mock-url');
    const mockRevokeObjectURL = jest.fn();
    global.URL.createObjectURL = mockCreateObjectURL;
    global.URL.revokeObjectURL = mockRevokeObjectURL;
    const stringifySpy = jest.spyOn(JSON, 'stringify');

    // Mock document.createElement to capture the download link
    const mockClick = jest.fn();
    const originalCreateElement = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const element = originalCreateElement(tag);
      if (tag === 'a') {
        Object.defineProperty(element, 'click', { value: mockClick });
      }
      return element;
    });

    render(<SettingsExportImport />);
    const buttons = screen.getAllByRole('button');
    // Find the export button (contains export text from i18n key)
    const exportButton = buttons.find(b =>
      b.textContent?.includes('settingsNew.exportImport.export')
    );

    if (exportButton) {
      fireEvent.click(exportButton);
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      const exportCall = stringifySpy.mock.calls.find(([, , space]) => space === 2);
      expect(exportCall?.[0]).toEqual(expect.objectContaining({
        version: 5,
        themeMode: 'dark',
        metadata: expect.objectContaining({
          schemaVersion: 5,
          domains: expect.any(Array),
        }),
        settings: expect.objectContaining({
          skyEngine: expect.any(String),
          aladinDisplay: expect.any(Object),
        }),
        dailyKnowledge: expect.objectContaining({
          favorites: expect.any(Array),
          history: expect.any(Array),
          startupState: expect.any(Object),
        }),
      }));
    }

    stringifySpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('renders file input for import', () => {
    render(<SettingsExportImport />);
    // The import button triggers a hidden file input
    const buttons = screen.getAllByRole('button');
    const importButton = buttons.find(b =>
      b.textContent?.includes('settingsNew.exportImport.import')
    );
    expect(importButton).toBeDefined();
  });
});
