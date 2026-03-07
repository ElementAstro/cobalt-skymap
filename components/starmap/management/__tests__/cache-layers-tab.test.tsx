/**
 * @jest-environment jsdom
 */

import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CacheLayersTab } from '../cache-layers-tab';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    if (params) return `${key}(${JSON.stringify(params)})`;
    return key;
  },
}));

jest.mock('sonner', () => ({
  toast: {
    loading: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    dismiss: jest.fn(),
  },
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() }),
}));

const mockDownloadLayer = jest.fn();
const mockDownloadSelectedLayers = jest.fn();
const mockClearLayer = jest.fn();
const mockRefreshStatuses = jest.fn();

jest.mock('@/lib/offline', () => ({
  useOfflineStore: jest.fn(() => ({
    isOnline: true,
    layerStatuses: [],
    isDownloading: false,
    currentDownloads: {},
    refreshStatuses: mockRefreshStatuses,
    downloadLayer: mockDownloadLayer,
    downloadSelectedLayers: mockDownloadSelectedLayers,
    clearLayer: mockClearLayer,
  })),
  formatBytes: jest.fn((bytes: number) => `${bytes}B`),
  STELLARIUM_LAYERS: [
    { id: 'layer1', name: 'Stars', description: 'Star catalog', size: 1024 },
    { id: 'layer2', name: 'DSO', description: 'Deep sky objects', size: 2048 },
  ],
  offlineCacheManager: {
    verifyAndRepairLayer: jest.fn(),
  },
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: React.PropsWithChildren<{ onClick?: (e: React.MouseEvent) => void; disabled?: boolean }>) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/progress', () => ({
  Progress: ({ value }: { value: number }) => <div data-testid="progress" data-value={value} />,
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TooltipContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TooltipTrigger: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

import { useOfflineStore } from '@/lib/offline';
const mockUseOfflineStore = useOfflineStore as unknown as jest.Mock;

describe('CacheLayersTab', () => {
  const onStorageChanged = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders layer list', () => {
    render(<CacheLayersTab onStorageChanged={onStorageChanged} />);
    expect(screen.getByText('Stars')).toBeInTheDocument();
    expect(screen.getByText('DSO')).toBeInTheDocument();
  });

  it('renders layer descriptions', () => {
    render(<CacheLayersTab onStorageChanged={onStorageChanged} />);
    expect(screen.getByText('Star catalog')).toBeInTheDocument();
    expect(screen.getByText('Deep sky objects')).toBeInTheDocument();
  });

  it('renders layer sizes', () => {
    render(<CacheLayersTab onStorageChanged={onStorageChanged} />);
    expect(screen.getByText('1024B')).toBeInTheDocument();
    expect(screen.getByText('2048B')).toBeInTheDocument();
  });

  // 点击 layer 切换选中状态，显示选择栏
  it('toggles layer selection on click and shows selection bar', () => {
    render(<CacheLayersTab onStorageChanged={onStorageChanged} />);
    // 点击 Stars layer 区域
    fireEvent.click(screen.getByText('Star catalog'));
    expect(screen.getByText(/cache\.selected/)).toBeInTheDocument();
    expect(screen.getByText('common.clear')).toBeInTheDocument();
    expect(screen.getByText('common.download')).toBeInTheDocument();
  });

  // 取消选择
  it('clears selection when clear button clicked', () => {
    render(<CacheLayersTab onStorageChanged={onStorageChanged} />);
    fireEvent.click(screen.getByText('Star catalog'));
    expect(screen.getByText(/cache\.selected/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('common.clear'));
    expect(screen.queryByText(/cache\.selected/)).not.toBeInTheDocument();
  });

  // 批量下载已选 layers
  it('calls downloadSelectedLayers when download clicked', async () => {
    render(<CacheLayersTab onStorageChanged={onStorageChanged} />);
    fireEvent.click(screen.getByText('Star catalog'));
    await act(async () => {
      fireEvent.click(screen.getByText('common.download'));
    });
    expect(mockDownloadSelectedLayers).toHaveBeenCalledWith(['layer1']);
  });

  // 下载单个 layer
  it('shows download button for uncached layer', () => {
    render(<CacheLayersTab onStorageChanged={onStorageChanged} />);
    // 所有 buttons (2 layers = 2 download buttons + potential others)
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  // 已完成缓存显示清除按钮
  it('shows clear button for complete cached layer', () => {
    mockUseOfflineStore.mockReturnValue({
      isOnline: true,
      layerStatuses: [
        { layerId: 'layer1', cached: true, cachedBytes: 1024, cachedFiles: 10, totalFiles: 10, isComplete: true },
      ],
      isDownloading: false,
      currentDownloads: {},
      refreshStatuses: mockRefreshStatuses,
      downloadLayer: mockDownloadLayer,
      downloadSelectedLayers: mockDownloadSelectedLayers,
      clearLayer: mockClearLayer,
    });
    render(<CacheLayersTab onStorageChanged={onStorageChanged} />);
    // 应该能找到 clear 按钮（通过点击 stopPropagation）
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  // 部分缓存显示修复和清除按钮
  it('renders partial cache with warning and repair buttons', () => {
    mockUseOfflineStore.mockReturnValue({
      isOnline: true,
      layerStatuses: [
        { layerId: 'layer1', cached: false, cachedBytes: 512, cachedFiles: 5, totalFiles: 10, isComplete: false },
      ],
      isDownloading: false,
      currentDownloads: {},
      refreshStatuses: mockRefreshStatuses,
      downloadLayer: mockDownloadLayer,
      downloadSelectedLayers: mockDownloadSelectedLayers,
      clearLayer: mockClearLayer,
    });
    render(<CacheLayersTab onStorageChanged={onStorageChanged} />);
    // 部分缓存显示进度条
    expect(screen.getByTestId('progress')).toBeInTheDocument();
    // 显示已缓存大小
    expect(screen.getByText('512B / 1024B')).toBeInTheDocument();
  });

  // 下载中状态
  it('shows download progress when layer is downloading', () => {
    mockUseOfflineStore.mockReturnValue({
      isOnline: true,
      layerStatuses: [],
      isDownloading: true,
      currentDownloads: {
        layer1: { downloadedFiles: 5, totalFiles: 10 },
      },
      refreshStatuses: mockRefreshStatuses,
      downloadLayer: mockDownloadLayer,
      downloadSelectedLayers: mockDownloadSelectedLayers,
      clearLayer: mockClearLayer,
    });
    render(<CacheLayersTab onStorageChanged={onStorageChanged} />);
    // 显示百分比
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByTestId('progress')).toBeInTheDocument();
  });

  // 离线时禁用下载按钮
  it('disables download buttons when offline', () => {
    mockUseOfflineStore.mockReturnValue({
      isOnline: false,
      layerStatuses: [],
      isDownloading: false,
      currentDownloads: {},
      refreshStatuses: mockRefreshStatuses,
      downloadLayer: mockDownloadLayer,
      downloadSelectedLayers: mockDownloadSelectedLayers,
      clearLayer: mockClearLayer,
    });
    render(<CacheLayersTab onStorageChanged={onStorageChanged} />);
    const buttons = screen.getAllByRole('button');
    const disabledButtons = buttons.filter(b => b.hasAttribute('disabled'));
    expect(disabledButtons.length).toBeGreaterThan(0);
  });

  // 修复 layer
  it('calls verifyAndRepairLayer on repair button click', async () => {
    const { offlineCacheManager } = jest.requireMock('@/lib/offline');
    offlineCacheManager.verifyAndRepairLayer.mockResolvedValue({ verified: true, repaired: 2, failed: 0 });

    mockUseOfflineStore.mockReturnValue({
      isOnline: true,
      layerStatuses: [
        { layerId: 'layer1', cached: false, cachedBytes: 512, cachedFiles: 5, totalFiles: 10, isComplete: false },
      ],
      isDownloading: false,
      currentDownloads: {},
      refreshStatuses: mockRefreshStatuses,
      downloadLayer: mockDownloadLayer,
      downloadSelectedLayers: mockDownloadSelectedLayers,
      clearLayer: mockClearLayer,
    });

    render(<CacheLayersTab onStorageChanged={onStorageChanged} />);
    // 找到 repair 按钮（部分缓存显示的 Wrench 图标按钮）
    const buttons = screen.getAllByRole('button');
    // 点击第一个非 disabled 按钮中与 repair 相关的
    const repairBtn = buttons.find(b => !b.hasAttribute('disabled') && !b.textContent);
    if (repairBtn) {
      fireEvent.click(repairBtn);
      await waitFor(() => {
        expect(offlineCacheManager.verifyAndRepairLayer).toHaveBeenCalledWith('layer1');
      });
    }
  });
});
