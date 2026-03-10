/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCamera } from '../use-camera';

// Mock MediaStream
class MockMediaStream {
  private tracks: Array<{ stop: jest.Mock; getCapabilities: jest.Mock; applyConstraints: jest.Mock; kind: string }>;

  constructor() {
    this.tracks = [
      {
        stop: jest.fn(),
        kind: 'video',
        getCapabilities: jest.fn(() => ({})),
        applyConstraints: jest.fn(),
      },
    ];
  }

  getTracks() {
    return this.tracks;
  }

  getVideoTracks() {
    return this.tracks.filter((t) => t.kind === 'video');
  }
}

// Mock navigator.mediaDevices
const mockGetUserMedia = jest.fn();
const mockEnumerateDevices = jest.fn();

Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockGetUserMedia,
    enumerateDevices: mockEnumerateDevices,
  },
  writable: true,
  configurable: true,
});

describe('useCamera', () => {
  let mockStream: MockMediaStream;
  let visibilityState: DocumentVisibilityState = 'visible';

  beforeEach(() => {
    jest.clearAllMocks();
    mockStream = new MockMediaStream();
    mockGetUserMedia.mockResolvedValue(mockStream);
    mockEnumerateDevices.mockResolvedValue([]);
    visibilityState = 'visible';
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState,
    });
  });

  describe('initialization', () => {
    it('returns correct initial state', () => {
      const { result } = renderHook(() => useCamera());

      expect(result.current.stream).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.errorType).toBeNull();
      expect(result.current.facingMode).toBe('environment');
      expect(result.current.devices).toEqual([]);
      expect(result.current.isSupported).toBe(true);
      expect(result.current.hasMultipleCameras).toBe(false);
      expect(result.current.zoomLevel).toBe(1);
      expect(result.current.torchOn).toBe(false);
    });

    it('respects initial facingMode option', () => {
      const { result } = renderHook(() => useCamera({ facingMode: 'user' }));
      expect(result.current.facingMode).toBe('user');
    });
  });

  describe('start', () => {
    it('calls getUserMedia with correct constraints', async () => {
      const { result } = renderHook(() => useCamera());

      await act(async () => {
        await result.current.start();
      });

      expect(mockGetUserMedia).toHaveBeenCalledWith({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      expect(result.current.stream).toBeTruthy();
      expect(result.current.error).toBeNull();
    });

    it('uses custom resolution when provided', async () => {
      const { result } = renderHook(() =>
        useCamera({ resolution: { label: '720p', width: 1280, height: 720 } }),
      );

      await act(async () => {
        await result.current.start();
      });

      expect(mockGetUserMedia).toHaveBeenCalledWith({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
    });

    it('handles NotAllowedError', async () => {
      const error = new Error('Permission denied');
      error.name = 'NotAllowedError';
      mockGetUserMedia.mockRejectedValue(error);

      const { result } = renderHook(() => useCamera());

      await act(async () => {
        await result.current.start();
      });

      expect(result.current.error).toBe('Permission denied');
      expect(result.current.errorType).toBe('permission-denied');
      expect(result.current.stream).toBeNull();
    });

    it('handles NotFoundError', async () => {
      const error = new Error('No camera');
      error.name = 'NotFoundError';
      mockGetUserMedia.mockRejectedValue(error);

      const { result } = renderHook(() => useCamera());

      await act(async () => {
        await result.current.start();
      });

      expect(result.current.errorType).toBe('not-found');
    });

    it('handles NotReadableError (camera in use)', async () => {
      const error = new Error('Camera busy');
      error.name = 'NotReadableError';
      mockGetUserMedia.mockRejectedValue(error);

      const { result } = renderHook(() => useCamera());

      await act(async () => {
        await result.current.start();
      });

      expect(result.current.errorType).toBe('in-use');
    });

    it('enumerates devices after successful start', async () => {
      mockEnumerateDevices.mockResolvedValue([
        { kind: 'videoinput', deviceId: 'cam1', label: 'Front', groupId: 'g1' },
        { kind: 'videoinput', deviceId: 'cam2', label: 'Back', groupId: 'g2' },
      ]);

      const { result } = renderHook(() => useCamera());

      await act(async () => {
        await result.current.start();
      });

      expect(result.current.devices).toHaveLength(2);
      expect(result.current.hasMultipleCameras).toBe(true);
    });
  });

  describe('stop', () => {
    it('stops all tracks and clears stream', async () => {
      const { result } = renderHook(() => useCamera());

      await act(async () => {
        await result.current.start();
      });

      expect(result.current.stream).toBeTruthy();

      act(() => {
        result.current.stop();
      });

      expect(result.current.stream).toBeNull();
      expect(mockStream.getTracks()[0].stop).toHaveBeenCalled();
    });
  });

  describe('switchCamera', () => {
    it('toggles between environment and user facing modes', async () => {
      const { result } = renderHook(() => useCamera({ facingMode: 'environment' }));

      await act(async () => {
        await result.current.start();
      });

      expect(result.current.facingMode).toBe('environment');

      // Create a new stream for the switch
      const newStream = new MockMediaStream();
      mockGetUserMedia.mockResolvedValue(newStream);

      await act(async () => {
        await result.current.switchCamera();
      });

      expect(result.current.facingMode).toBe('user');
      expect(mockGetUserMedia).toHaveBeenLastCalledWith(
        expect.objectContaining({
          video: expect.objectContaining({ facingMode: 'user' }),
        }),
      );
    });
  });

  describe('setFacingMode', () => {
    it('does not restart if same mode', async () => {
      const { result } = renderHook(() => useCamera({ facingMode: 'environment' }));

      await act(async () => {
        await result.current.start();
      });

      mockGetUserMedia.mockClear();

      await act(async () => {
        await result.current.setFacingMode('environment');
      });

      expect(mockGetUserMedia).not.toHaveBeenCalled();
    });

    it('restarts with new mode when different', async () => {
      const { result } = renderHook(() => useCamera({ facingMode: 'environment' }));

      await act(async () => {
        await result.current.start();
      });

      const newStream = new MockMediaStream();
      mockGetUserMedia.mockResolvedValue(newStream);

      await act(async () => {
        await result.current.setFacingMode('user');
      });

      expect(result.current.facingMode).toBe('user');
    });
  });

  describe('enumerateDevices', () => {
    it('lists video input devices', async () => {
      mockEnumerateDevices.mockResolvedValue([
        { kind: 'videoinput', deviceId: 'cam1', label: 'Camera 1', groupId: 'g1' },
        { kind: 'audioinput', deviceId: 'mic1', label: 'Mic 1', groupId: 'g2' },
        { kind: 'videoinput', deviceId: 'cam2', label: '', groupId: 'g3' },
      ]);

      const { result } = renderHook(() => useCamera());

      await act(async () => {
        await result.current.enumerateDevices();
      });

      expect(result.current.devices).toHaveLength(2);
      expect(result.current.devices[0].label).toBe('Camera 1');
      expect(result.current.devices[1].label).toContain('Camera'); // Fallback label
    });
  });

  describe('capture', () => {
    it('returns null when refs are missing', () => {
      const { result } = renderHook(() => useCamera());
      const videoRef = { current: null };
      const canvasRef = { current: null };

      const captured = result.current.capture(videoRef, canvasRef);
      expect(captured).toBeNull();
    });
  });

  describe('cleanup', () => {
    it('stops stream on unmount', async () => {
      const { result, unmount } = renderHook(() => useCamera());

      await act(async () => {
        await result.current.start();
      });

      unmount();

      expect(mockStream.getTracks()[0].stop).toHaveBeenCalled();
    });
  });

  describe('visibility lifecycle', () => {
    it('pauses stream on hidden and resumes on visible', async () => {
      const { result } = renderHook(() => useCamera());

      await act(async () => {
        await result.current.start();
      });
      expect(result.current.stream).toBeTruthy();

      visibilityState = 'hidden';
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      expect(result.current.stream).toBeNull();
      expect(mockStream.getTracks()[0].stop).toHaveBeenCalled();

      const resumedStream = new MockMediaStream();
      mockGetUserMedia.mockResolvedValue(resumedStream);

      visibilityState = 'visible';
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalledTimes(2);
        expect(result.current.stream).toBeTruthy();
      });
    });

    it('does not auto-resume after explicit stop', async () => {
      const { result } = renderHook(() => useCamera());

      await act(async () => {
        await result.current.start();
      });

      act(() => {
        result.current.stop();
      });

      visibilityState = 'hidden';
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      visibilityState = 'visible';
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalledTimes(1);
      });
    });
  });
});
