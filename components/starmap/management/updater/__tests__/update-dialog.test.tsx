/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EXTERNAL_LINKS } from '@/lib/constants/external-links';

const mockUseUpdater = jest.fn();
const mockOpenExternalUrl = jest.fn();

jest.mock('@/lib/tauri/updater-hooks', () => ({
  useUpdater: () => mockUseUpdater(),
}));

jest.mock('@/lib/tauri/app-control-api', () => ({
  openExternalUrl: (url: string) => mockOpenExternalUrl(url),
}));

jest.mock('@/lib/tauri/updater-api', () => ({
  formatProgress: jest.fn((progress) => {
    if (progress.total) {
      return `${progress.downloaded} / ${progress.total} (${progress.percent.toFixed(1)}%)`;
    }
    return `${progress.downloaded}`;
  }),
  formatBytes: jest.fn((bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, string>) => {
    const translations: Record<string, string> = {
      title: 'Software Update',
      description: 'Check for updates',
      checking: 'Checking...',
      downloading: 'Downloading...',
      ready: 'Ready to install',
      restartRequired: 'Restart required',
      upToDate: 'Up to date',
      newVersion: params?.version ? `Version ${params.version} available` : 'New version available',
      currentVersion: params?.version ? `Current: ${params.version}` : 'Current version',
      releaseNotes: "What's New",
      updateNow: 'Update Now',
      later: 'Later',
      retry: 'Retry',
      close: 'Close',
      checkAgain: 'Check Again',
      restartNow: 'Restart Now',
      skipVersion: 'Skip This Version',
      openReleases: 'Open Releases',
      downloadSpeed: params?.speed ? `${params.speed}/s` : '',
      timeRemaining: params?.time ? `${params.time} remaining` : '',
    };
    return translations[key] || key;
  },
}));

import { UpdateDialog } from '../update-dialog';

const renderComponent = (open: boolean, onOpenChange: jest.Mock = jest.fn()) => {
  return render(<UpdateDialog open={open} onOpenChange={onOpenChange} />);
};

describe('UpdateDialog', () => {
  const defaultMockReturn = {
    currentVersion: '1.0.0',
    isChecking: false,
    isDownloading: false,
    isReady: false,
    hasUpdate: false,
    updateInfo: null,
    progress: null,
    error: null,
    downloadSpeed: null,
    estimatedTimeRemaining: null,
    checkForUpdate: jest.fn(),
    downloadAndInstall: jest.fn(),
    dismissUpdate: jest.fn(),
    skipVersion: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseUpdater.mockReturnValue(defaultMockReturn);
  });

  it('should render dialog when open', () => {
    renderComponent(true);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('should not render dialog when closed', () => {
    renderComponent(false);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should show checking state with spinner', () => {
    mockUseUpdater.mockReturnValue({
      ...defaultMockReturn,
      isChecking: true,
    });

    renderComponent(true);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('should show up to date message when no update available', () => {
    renderComponent(true);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('should show update available with version info', () => {
    mockUseUpdater.mockReturnValue({
      ...defaultMockReturn,
      hasUpdate: true,
      updateInfo: {
        version: '1.0.1',
        current_version: '1.0.0',
        date: '2024-01-01T00:00:00Z',
        body: 'Bug fixes and improvements',
      },
    });

    renderComponent(true);

    expect(screen.getByText('Bug fixes and improvements')).toBeInTheDocument();
  });

  it('should show download progress when downloading', () => {
    mockUseUpdater.mockReturnValue({
      ...defaultMockReturn,
      isDownloading: true,
      hasUpdate: true,
      progress: {
        downloaded: 500000,
        total: 1000000,
        percent: 50,
      },
    });

    renderComponent(true);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('500000 / 1000000 (50.0%)')).toBeInTheDocument();
  });

  it('should show ready state when update is ready', () => {
    mockUseUpdater.mockReturnValue({
      ...defaultMockReturn,
      isReady: true,
      hasUpdate: true,
      updateInfo: {
        version: '1.0.1',
        current_version: '1.0.0',
        date: null,
        body: null,
      },
    });

    renderComponent(true);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('should show error message when error occurs', () => {
    mockUseUpdater.mockReturnValue({
      ...defaultMockReturn,
      error: 'Network connection failed',
    });

    renderComponent(true);

    expect(screen.getByText('Network connection failed')).toBeInTheDocument();
  });

  it('should call checkForUpdate when retry button is clicked', async () => {
    const checkForUpdate = jest.fn();
    mockUseUpdater.mockReturnValue({
      ...defaultMockReturn,
      error: 'Network error',
      checkForUpdate,
    });

    renderComponent(true);

    const buttons = screen.getAllByRole('button');
    const retryButton = buttons.find(b => b.textContent?.toLowerCase().includes('retry'));
    if (retryButton) fireEvent.click(retryButton);

    expect(checkForUpdate).toHaveBeenCalled();
  });

  it('should show an open releases action for updater configuration errors', () => {
    mockUseUpdater.mockReturnValue({
      ...defaultMockReturn,
      error: 'Update service is not configured for this build.',
    });

    renderComponent(true);

    expect(screen.getByRole('button', { name: 'Open Releases' })).toBeInTheDocument();
  });

  it('should open GitHub releases when the fallback action is clicked', () => {
    mockUseUpdater.mockReturnValue({
      ...defaultMockReturn,
      error: 'Signature verification failed. Please download the release manually from GitHub Releases.',
    });

    renderComponent(true);

    fireEvent.click(screen.getByRole('button', { name: 'Open Releases' }));

    expect(mockOpenExternalUrl).toHaveBeenCalledWith(EXTERNAL_LINKS.releases);
  });

  it('should call downloadAndInstall when update now button is clicked', async () => {
    const downloadAndInstall = jest.fn();
    mockUseUpdater.mockReturnValue({
      ...defaultMockReturn,
      hasUpdate: true,
      updateInfo: {
        version: '1.0.1',
        current_version: '1.0.0',
        date: null,
        body: null,
      },
      downloadAndInstall,
    });

    renderComponent(true);

    const buttons = screen.getAllByRole('button');
    const updateButton = buttons.find(b => b.textContent?.toLowerCase().includes('update'));
    if (updateButton) fireEvent.click(updateButton);

    expect(downloadAndInstall).toHaveBeenCalled();
  });

  it('should call dismissUpdate and close dialog when later button is clicked', async () => {
    const dismissUpdate = jest.fn();
    const onOpenChange = jest.fn();
    mockUseUpdater.mockReturnValue({
      ...defaultMockReturn,
      hasUpdate: true,
      updateInfo: {
        version: '1.0.1',
        current_version: '1.0.0',
        date: null,
        body: null,
      },
      dismissUpdate,
    });

    renderComponent(true, onOpenChange);

    const buttons = screen.getAllByRole('button');
    const laterButton = buttons.find(b => b.textContent?.toLowerCase().includes('later'));
    if (laterButton) fireEvent.click(laterButton);

    expect(dismissUpdate).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('should not close dialog when downloading', () => {
    const onOpenChange = jest.fn();
    mockUseUpdater.mockReturnValue({
      ...defaultMockReturn,
      isDownloading: true,
      hasUpdate: true,
      progress: { downloaded: 0, total: 1000, percent: 0 },
    });

    renderComponent(true, onOpenChange);

    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
  });

  it('should call checkForUpdate when check again button is clicked', async () => {
    const checkForUpdate = jest.fn();
    mockUseUpdater.mockReturnValue({
      ...defaultMockReturn,
      checkForUpdate,
    });

    renderComponent(true);

    const buttons = screen.getAllByRole('button');
    const checkAgainButton = buttons.find(b => b.textContent?.toLowerCase().includes('check'));
    if (checkAgainButton) fireEvent.click(checkAgainButton);

    expect(checkForUpdate).toHaveBeenCalled();
  });

  it('should show close button when up to date', () => {
    const onOpenChange = jest.fn();
    renderComponent(true, onOpenChange);

    const buttons = screen.getAllByRole('button');
    const closeButton = buttons.find(b => b.textContent?.toLowerCase().includes('close'));
    if (closeButton) fireEvent.click(closeButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('should show skip version button when update is available', () => {
    mockUseUpdater.mockReturnValue({
      ...defaultMockReturn,
      hasUpdate: true,
      updateInfo: {
        version: '1.0.1',
        current_version: '1.0.0',
        date: null,
        body: null,
      },
    });

    renderComponent(true);

    const buttons = screen.getAllByRole('button');
    const skipButton = buttons.find(b => b.textContent?.includes('Skip This Version'));
    expect(skipButton).toBeDefined();
  });

  it('should call skipVersion and close dialog when skip button is clicked', () => {
    const skipVersion = jest.fn();
    const onOpenChange = jest.fn();
    mockUseUpdater.mockReturnValue({
      ...defaultMockReturn,
      hasUpdate: true,
      updateInfo: {
        version: '1.0.1',
        current_version: '1.0.0',
        date: null,
        body: null,
      },
      skipVersion,
    });

    renderComponent(true, onOpenChange);

    const buttons = screen.getAllByRole('button');
    const skipButton = buttons.find(b => b.textContent?.includes('Skip This Version'));
    if (skipButton) fireEvent.click(skipButton);

    expect(skipVersion).toHaveBeenCalledWith('1.0.1');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('should render release notes as markdown HTML', () => {
    mockUseUpdater.mockReturnValue({
      ...defaultMockReturn,
      hasUpdate: true,
      updateInfo: {
        version: '1.0.1',
        current_version: '1.0.0',
        date: null,
        body: '## Changelog\n- Fixed a bug\n- **Important** improvement',
      },
    });

    renderComponent(true);

    // Markdown should be rendered as HTML, not raw markdown
    expect(screen.queryByText('## Changelog')).not.toBeInTheDocument();
    // The rendered HTML should contain the items
    expect(screen.getByText(/Fixed a bug/)).toBeInTheDocument();
    expect(screen.getByText(/Important/)).toBeInTheDocument();
  });

  it('should show download speed when downloading with metrics', () => {
    mockUseUpdater.mockReturnValue({
      ...defaultMockReturn,
      isDownloading: true,
      hasUpdate: true,
      progress: {
        downloaded: 500000,
        total: 1000000,
        percent: 50,
      },
      downloadSpeed: 1048576,
      estimatedTimeRemaining: 5,
    });

    renderComponent(true);

    expect(screen.getByText(/1 MB\/s/)).toBeInTheDocument();
    expect(screen.getByText(/5s remaining/)).toBeInTheDocument();
  });

  it('should not show speed/ETA section when metrics are null', () => {
    mockUseUpdater.mockReturnValue({
      ...defaultMockReturn,
      isDownloading: true,
      hasUpdate: true,
      progress: {
        downloaded: 500000,
        total: 1000000,
        percent: 50,
      },
      downloadSpeed: null,
      estimatedTimeRemaining: null,
    });

    renderComponent(true);

    expect(screen.queryByText(/remaining/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\/s/)).not.toBeInTheDocument();
  });

  it('should not show skip button when downloading', () => {
    mockUseUpdater.mockReturnValue({
      ...defaultMockReturn,
      isDownloading: true,
      hasUpdate: true,
      progress: { downloaded: 0, total: 1000, percent: 0 },
    });

    renderComponent(true);

    const buttons = screen.getAllByRole('button');
    const skipButton = buttons.find(b => b.textContent?.includes('Skip This Version'));
    expect(skipButton).toBeUndefined();
  });

  it('should not show skip button when ready', () => {
    mockUseUpdater.mockReturnValue({
      ...defaultMockReturn,
      isReady: true,
      hasUpdate: true,
      updateInfo: {
        version: '1.0.1',
        current_version: '1.0.0',
        date: null,
        body: null,
      },
    });

    renderComponent(true);

    const buttons = screen.getAllByRole('button');
    const skipButton = buttons.find(b => b.textContent?.includes('Skip This Version'));
    expect(skipButton).toBeUndefined();
  });
});
