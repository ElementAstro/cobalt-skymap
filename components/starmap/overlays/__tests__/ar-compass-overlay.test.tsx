/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';

// Mock stellarium store
let mockViewDirection: { az: number; alt: number } | null = null;
let mockSensorRuntime: {
  status: string;
  degradedReason: 'relative-source' | 'low-confidence' | 'stale-sample' | null;
  error: string | null;
} = {
  status: 'active',
  degradedReason: null,
  error: null,
};

jest.mock('@/lib/stores', () => ({
  useStellariumStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ viewDirection: mockViewDirection }),
}));

jest.mock('@/lib/stores/ar-runtime-store', () => ({
  useARRuntimeStore: (selector: (state: { sensor: typeof mockSensorRuntime }) => unknown) =>
    selector({ sensor: mockSensorRuntime }),
}));

jest.mock('@/lib/astronomy/starmap-utils', () => ({
  rad2deg: (v: number) => v * (180 / Math.PI),
}));

import { ARCompassOverlay } from '../ar-compass-overlay';

describe('ARCompassOverlay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockViewDirection = null;
    mockSensorRuntime = {
      status: 'active',
      degradedReason: null,
      error: null,
    };
  });

  it('renders nothing when disabled', () => {
    const { container } = render(<ARCompassOverlay enabled={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders overlay when enabled', () => {
    render(<ARCompassOverlay enabled={true} />);
    expect(screen.getByTestId('ar-compass-overlay')).toBeInTheDocument();
  });

  it('still renders with session status metadata when session is blocked', () => {
    render(
      <ARCompassOverlay enabled={true} sessionStatus="blocked" />
    );
    expect(screen.getByTestId('ar-compass-overlay')).toHaveAttribute('data-ar-session-status', 'blocked');
  });

  it('renders in degraded sensor-only mode', () => {
    render(<ARCompassOverlay enabled={true} sessionStatus="degraded-sensor-only" />);
    expect(screen.getByTestId('ar-compass-overlay')).toBeInTheDocument();
  });

  it('defaults to azDeg=0 and altDeg=0 when viewDirection is null', () => {
    render(<ARCompassOverlay enabled={true} />);
    // azDeg = 0.0, altDeg = 0.0
    expect(screen.getByText('0.0°')).toBeInTheDocument();
    expect(screen.getByText('Alt 0.0°')).toBeInTheDocument();
  });

  it('calculates azimuth and altitude from viewDirection', () => {
    // az = PI/2 → 90°, alt = PI/6 → 30°
    mockViewDirection = { az: Math.PI / 2, alt: Math.PI / 6 };
    render(<ARCompassOverlay enabled={true} />);
    expect(screen.getByText('90.0°')).toBeInTheDocument();
    expect(screen.getByText('Alt 30.0°')).toBeInTheDocument();
  });

  it('normalizes negative azimuth values', () => {
    // az = -PI/2 → rad2deg = -90 → normalizeAz = 270
    mockViewDirection = { az: -Math.PI / 2, alt: 0 };
    render(<ARCompassOverlay enabled={true} />);
    expect(screen.getByText('270.0°')).toBeInTheDocument();
  });

  it('applies green color for altitude > 30', () => {
    mockViewDirection = { az: 0, alt: (Math.PI / 180) * 45 }; // 45°
    render(<ARCompassOverlay enabled={true} />);
    const altSpan = screen.getByText(/Alt 45/);
    expect(altSpan.className).toContain('text-green-400/70');
  });

  it('applies yellow color for altitude between 0 and 30', () => {
    mockViewDirection = { az: 0, alt: (Math.PI / 180) * 15 }; // 15°
    render(<ARCompassOverlay enabled={true} />);
    const altSpan = screen.getByText(/Alt 15/);
    expect(altSpan.className).toContain('text-yellow-400/70');
  });

  it('applies red color for altitude <= 0', () => {
    mockViewDirection = { az: 0, alt: (Math.PI / 180) * -5 }; // -5°
    render(<ARCompassOverlay enabled={true} />);
    const altSpan = screen.getByText(/Alt -5/);
    expect(altSpan.className).toContain('text-red-400/70');
  });

  it('renders compass labels visible within the window', () => {
    // azDeg = 0 → N should be centered (offset=50%), NE at 45° and NW at 315° should also be visible
    mockViewDirection = { az: 0, alt: 0 };
    render(<ARCompassOverlay enabled={true} />);
    // Cardinal "N" is translated via t()
    expect(screen.getByText('compass.n')).toBeInTheDocument();
  });

  it('renders tick marks', () => {
    mockViewDirection = { az: 0, alt: 0 };
    const { container } = render(<ARCompassOverlay enabled={true} />);
    // Ticks are rendered as divs with absolute positioning
    const ticks = container.querySelectorAll('.bg-white\\/40, .bg-white\\/20');
    expect(ticks.length).toBeGreaterThan(0);
  });

  it('handles non-finite altitude gracefully', () => {
    mockViewDirection = { az: 0, alt: Infinity };
    render(<ARCompassOverlay enabled={true} />);
    // Should fallback to 0
    expect(screen.getByText('Alt 0.0°')).toBeInTheDocument();
  });

  it('renders intercardinal labels as raw keys (NE, SE, etc.)', () => {
    // azDeg = 45 → NE is centered
    mockViewDirection = { az: (Math.PI / 180) * 45, alt: 0 };
    render(<ARCompassOverlay enabled={true} />);
    expect(screen.getByText('NE')).toBeInTheDocument();
  });

  it('hides numeric heading readout when pointing status is degraded', () => {
    mockViewDirection = { az: Math.PI / 3, alt: Math.PI / 6 };
    mockSensorRuntime = {
      status: 'degraded',
      degradedReason: 'low-confidence',
      error: null,
    };

    render(<ARCompassOverlay enabled={true} sessionStatus="degraded-camera-only" />);
    expect(screen.queryByText('60.0°')).not.toBeInTheDocument();
    expect(screen.getAllByText('settings.sensorDegradedLowConfidence').length).toBeGreaterThan(0);
  });

  it('shows permission fallback copy when permission is denied', () => {
    mockSensorRuntime = {
      status: 'permission-denied',
      degradedReason: null,
      error: null,
    };

    render(<ARCompassOverlay enabled={true} />);
    expect(screen.getByText('settings.sensorFallbackRequestPermission')).toBeInTheDocument();
  });
});
