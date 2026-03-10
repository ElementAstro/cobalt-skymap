/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ARCameraBackground } from '../ar-camera-background';
import type { ARSessionStatus } from '@/lib/core/ar-session';

const mockStart = jest.fn();
const mockStop = jest.fn();
const mockSwitchCamera = jest.fn();
const mockToggleTorch = jest.fn();

let mockStream: MediaStream | null = null;
let mockIsLoading = false;
let mockError: string | null = null;
let mockErrorType: string | null = null;
let mockIsSupported = true;
let mockHasMultipleCameras = false;
let mockTorchOn = false;
let mockCapabilities: { torch?: boolean } = {};
let mockSessionStatus: ARSessionStatus = 'ready';

jest.mock('@/lib/hooks/use-camera', () => ({
  useCamera: () => ({
    stream: mockStream,
    isLoading: mockIsLoading,
    error: mockError,
    errorType: mockErrorType,
    facingMode: 'environment',
    devices: [],
    capabilities: mockCapabilities,
    isSupported: mockIsSupported,
    hasMultipleCameras: mockHasMultipleCameras,
    zoomLevel: 1,
    torchOn: mockTorchOn,
    start: mockStart,
    stop: mockStop,
    switchCamera: mockSwitchCamera,
    setFacingMode: jest.fn(),
    capture: jest.fn(),
    setZoom: jest.fn(),
    toggleTorch: mockToggleTorch,
    enumerateDevices: jest.fn(),
  }),
}));

jest.mock('@/lib/hooks/use-ar-session-status', () => ({
  useARSessionStatus: () => ({
    status: mockSessionStatus,
    cameraLayerEnabled: true,
    sensorPointingEnabled: true,
    compassEnabled: true,
    needsUserAction: mockSessionStatus !== 'ready',
    recoveryActions: [],
  }),
}));

// jsdom has no MediaStream, create a minimal mock
class MockMediaStream {
  getTracks() { return []; }
  getAudioTracks() { return []; }
  getVideoTracks() { return []; }
}

// jest.setup.ts globally mocks next-intl: useTranslations returns raw key,
// NextIntlClientProvider is a passthrough. So we render directly.
const renderComponent = (ui: React.ReactElement) => render(ui);

describe('ARCameraBackground', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStream = null;
    mockIsLoading = false;
    mockError = null;
    mockErrorType = null;
    mockIsSupported = true;
    mockHasMultipleCameras = false;
    mockTorchOn = false;
    mockCapabilities = {};
    mockSessionStatus = 'ready';
  });

  it('renders nothing when disabled', () => {
    const { container } = renderComponent(<ARCameraBackground enabled={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('calls camera.start when enabled', () => {
    renderComponent(<ARCameraBackground enabled={true} />);
    expect(mockStart).toHaveBeenCalled();
  });

  it('shows loading state when camera is loading', () => {
    mockIsLoading = true;
    renderComponent(<ARCameraBackground enabled={true} />);
    expect(screen.getByText('common.loading')).toBeInTheDocument();
  });

  it('shows error state for permission denied', () => {
    mockError = 'Permission denied';
    mockErrorType = 'permission-denied';
    renderComponent(<ARCameraBackground enabled={true} />);
    expect(screen.getByText('settings.arCameraPermission')).toBeInTheDocument();
  });

  it('shows error state for not supported', () => {
    mockError = 'Not supported';
    mockErrorType = 'not-supported';
    renderComponent(<ARCameraBackground enabled={true} />);
    expect(screen.getByText('settings.arNotSupported')).toBeInTheDocument();
  });

  it('shows generic error for unknown camera error', () => {
    mockError = 'Unknown error';
    mockErrorType = 'unknown';
    renderComponent(<ARCameraBackground enabled={true} />);
    expect(screen.getByText('settings.arCameraError')).toBeInTheDocument();
  });

  it('shows retry button on error', () => {
    mockError = 'Failed';
    mockErrorType = 'unknown';
    renderComponent(<ARCameraBackground enabled={true} />);
    expect(screen.getByText('common.retry')).toBeInTheDocument();
  });

  it('renders video element when stream is available', () => {
    mockStream = new MockMediaStream() as unknown as MediaStream;
    renderComponent(<ARCameraBackground enabled={true} />);
    const video = document.querySelector('video');
    expect(video).toBeInTheDocument();
    expect(video?.getAttribute('aria-label')).toBe('AR camera background');
  });

  it('renders switch camera button when multiple cameras available', () => {
    mockStream = new MockMediaStream() as unknown as MediaStream;
    mockHasMultipleCameras = true;
    renderComponent(<ARCameraBackground enabled={true} />);
    expect(screen.getByLabelText(/switchCamera|Switch camera/i)).toBeInTheDocument();
  });

  it('renders torch button when torch capability is available', () => {
    mockStream = new MockMediaStream() as unknown as MediaStream;
    mockCapabilities = { torch: true };
    renderComponent(<ARCameraBackground enabled={true} />);
    expect(screen.getByLabelText('Torch')).toBeInTheDocument();
  });

  it('does not render camera controls when no stream', () => {
    mockHasMultipleCameras = true;
    mockCapabilities = { torch: true };
    renderComponent(<ARCameraBackground enabled={true} />);
    expect(screen.queryByLabelText('Torch')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    mockError = 'Failed';
    mockErrorType = 'unknown';
    const { container } = renderComponent(<ARCameraBackground enabled={true} className="my-class" />);
    expect(container.querySelector('.my-class')).toBeInTheDocument();
  });

  it('shows AR preflight status chip when session is not ready', () => {
    mockSessionStatus = 'preflight';
    mockStream = new MockMediaStream() as unknown as MediaStream;
    renderComponent(<ARCameraBackground enabled={true} />);
    expect(screen.getByText('settings.arStatusPreflight')).toBeInTheDocument();
  });
});
