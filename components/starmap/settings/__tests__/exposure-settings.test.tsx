/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

const mockUseEquipmentStore = jest.fn((selector) => {
  const state = {
    exposureDefaults: {
      exposureTime: 120,
      gain: 100,
      offset: 30,
      binning: '1x1',
      filter: 'L',
      frameCount: 30,
      ditherEnabled: true,
      ditherEvery: 3,
      tracking: 'guided',
      targetType: 'nebula',
      bortle: 5,
      sqmOverride: undefined,
      filterBandwidthNm: 300,
      readNoiseLimitPercent: 5,
      gainStrategy: 'unity',
      manualGain: 100,
      manualReadNoiseEnabled: false,
      manualReadNoise: 1.8,
      manualDarkCurrent: 0.002,
      manualFullWell: 50000,
      manualQE: 0.8,
      manualEPeraDu: 1,
      targetSurfaceBrightness: 22,
      targetSignalRate: 0,
    },
    setExposureDefaults: jest.fn(),
  };
  return selector ? selector(state) : state;
});

jest.mock('@/lib/stores', () => ({
  useEquipmentStore: (selector: (state: unknown) => unknown) => mockUseEquipmentStore(selector),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, variant }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode; variant?: string }) => (
    <button onClick={onClick} data-testid="button" data-variant={variant}>{children}</button>
  ),
}));

jest.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} data-testid="input" />,
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label data-testid="label">{children}</label>,
}));

jest.mock('@/components/ui/separator', () => ({
  Separator: () => <hr data-testid="separator" />,
}));

jest.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, id }: { checked?: boolean; id?: string }) => (
    <input type="checkbox" checked={checked} data-testid={`switch-${id || 'default'}`} readOnly />
  ),
}));

jest.mock('@/components/ui/slider', () => ({
  Slider: ({ value }: { value?: number[] }) => (
    <input type="range" value={value?.[0] || 0} data-testid="slider" readOnly />
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div data-testid="select">{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <option>{children}</option>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="select-trigger">{children}</div>,
  SelectValue: () => <span>Select...</span>,
}));

import { ExposureSettings } from '../exposure-settings';

describe('ExposureSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders exposure settings component', () => {
    render(<ExposureSettings />);
    expect(screen.getAllByTestId('label').length).toBeGreaterThan(0);
  });

  it('renders advanced model default controls', () => {
    render(<ExposureSettings />);
    expect(screen.getByText('exposure.advancedModelDefaults')).toBeInTheDocument();
    fireEvent.click(screen.getByText('exposure.advancedModelDefaults'));
    expect(screen.getByText('exposure.readNoiseLimitPercent')).toBeInTheDocument();
    expect(screen.getByText('exposure.gainStrategy')).toBeInTheDocument();
  });

  it('renders exposure time buttons', () => {
    render(<ExposureSettings />);
    // Preset exposure options are rendered as toggle items
    expect(screen.getByRole('radio', { name: '30s' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '60s' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '120s' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '180s' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '300s' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '600s' })).toBeInTheDocument();
  });

  it('renders gain and offset inputs', () => {
    render(<ExposureSettings />);
    expect(screen.getAllByTestId('input').length).toBeGreaterThanOrEqual(2);
  });

  it('renders binning buttons', () => {
    render(<ExposureSettings />);
    expect(screen.getByText('1x1')).toBeInTheDocument();
    expect(screen.getByText('2x2')).toBeInTheDocument();
    expect(screen.getByText('3x3')).toBeInTheDocument();
    expect(screen.getByText('4x4')).toBeInTheDocument();
  });

  it('renders filter select', () => {
    render(<ExposureSettings />);
    expect(screen.getByTestId('select')).toBeInTheDocument();
  });

  it('renders frame count slider', () => {
    render(<ExposureSettings />);
    expect(screen.getAllByTestId('slider').length).toBeGreaterThanOrEqual(2);
  });

  it('renders dither toggle', () => {
    render(<ExposureSettings />);
    expect(screen.getByTestId('switch-dither-enabled')).toBeInTheDocument();
  });

  it('renders bortle slider', () => {
    render(<ExposureSettings />);
    expect(screen.getByTestId('badge')).toBeInTheDocument();
  });

  it('renders tracking type buttons', () => {
    render(<ExposureSettings />);
    // Tracking buttons: none, basic, guided
    expect(screen.getAllByTestId('button').length).toBeGreaterThan(0);
  });

  it('renders target type buttons', () => {
    render(<ExposureSettings />);
    // Target type buttons: galaxy, nebula, cluster, planetary
    expect(screen.getAllByTestId('button').length).toBeGreaterThan(0);
  });

  it('renders separators between sections', () => {
    render(<ExposureSettings />);
    expect(screen.getAllByTestId('separator').length).toBeGreaterThan(0);
  });
});

describe('ExposureSettings validation and edge cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('handles minimum exposure values', () => {
    mockUseEquipmentStore.mockImplementation((selector) => {
      const state = {
        exposureDefaults: {
          exposureTime: 1,
          gain: 0,
          offset: 0,
          binning: '1x1',
          filter: 'NoFilter',
          frameCount: 1,
          ditherEnabled: false,
          ditherEvery: 1,
          tracking: 'none',
          targetType: 'galaxy',
          bortle: 1,
        },
        setExposureDefaults: jest.fn(),
      };
      return selector ? selector(state) : state;
    });

    render(<ExposureSettings />);
    expect(screen.getAllByTestId('button').length).toBeGreaterThan(0);
  });

  it('handles maximum exposure values', () => {
    mockUseEquipmentStore.mockImplementation((selector) => {
      const state = {
        exposureDefaults: {
          exposureTime: 600,
          gain: 500,
          offset: 200,
          binning: '4x4',
          filter: 'Ha',
          frameCount: 200,
          ditherEnabled: true,
          ditherEvery: 10,
          tracking: 'guided',
          targetType: 'nebula',
          bortle: 9,
        },
        setExposureDefaults: jest.fn(),
      };
      return selector ? selector(state) : state;
    });

    render(<ExposureSettings />);
    expect(screen.getByTestId('badge')).toBeInTheDocument();
  });

  it('handles all binning options', () => {
    const binningOptions = ['1x1', '2x2', '3x3', '4x4'];
    
    binningOptions.forEach(binning => {
      mockUseEquipmentStore.mockImplementation((selector) => {
        const state = {
          exposureDefaults: {
            exposureTime: 120,
            gain: 100,
            offset: 30,
            binning,
            filter: 'L',
            frameCount: 30,
            ditherEnabled: true,
            ditherEvery: 3,
            tracking: 'guided',
            targetType: 'nebula',
            bortle: 5,
          },
          setExposureDefaults: jest.fn(),
        };
        return selector ? selector(state) : state;
      });

      const { unmount } = render(<ExposureSettings />);
      expect(screen.getAllByTestId('button').length).toBeGreaterThan(0);
      unmount();
    });
  });

  it('handles all filter options', () => {
    const filters = ['L', 'R', 'G', 'B', 'Ha', 'OIII', 'SII', 'NoFilter'];
    
    filters.forEach(filter => {
      mockUseEquipmentStore.mockImplementation((selector) => {
        const state = {
          exposureDefaults: {
            exposureTime: 120,
            gain: 100,
            offset: 30,
            binning: '1x1',
            filter,
            frameCount: 30,
            ditherEnabled: true,
            ditherEvery: 3,
            tracking: 'guided',
            targetType: 'nebula',
            bortle: 5,
          },
          setExposureDefaults: jest.fn(),
        };
        return selector ? selector(state) : state;
      });

      const { unmount } = render(<ExposureSettings />);
      expect(screen.getByTestId('select')).toBeInTheDocument();
      unmount();
    });
  });

  it('handles all tracking types', () => {
    const trackingTypes = ['none', 'basic', 'guided'];
    
    trackingTypes.forEach(tracking => {
      mockUseEquipmentStore.mockImplementation((selector) => {
        const state = {
          exposureDefaults: {
            exposureTime: 120,
            gain: 100,
            offset: 30,
            binning: '1x1',
            filter: 'L',
            frameCount: 30,
            ditherEnabled: true,
            ditherEvery: 3,
            tracking,
            targetType: 'nebula',
            bortle: 5,
          },
          setExposureDefaults: jest.fn(),
        };
        return selector ? selector(state) : state;
      });

      const { unmount } = render(<ExposureSettings />);
      expect(screen.getAllByTestId('button').length).toBeGreaterThan(0);
      unmount();
    });
  });

  it('handles all target types', () => {
    const targetTypes = ['galaxy', 'nebula', 'cluster', 'planetary'];
    
    targetTypes.forEach(targetType => {
      mockUseEquipmentStore.mockImplementation((selector) => {
        const state = {
          exposureDefaults: {
            exposureTime: 120,
            gain: 100,
            offset: 30,
            binning: '1x1',
            filter: 'L',
            frameCount: 30,
            ditherEnabled: true,
            ditherEvery: 3,
            tracking: 'guided',
            targetType,
            bortle: 5,
          },
          setExposureDefaults: jest.fn(),
        };
        return selector ? selector(state) : state;
      });

      const { unmount } = render(<ExposureSettings />);
      expect(screen.getAllByTestId('button').length).toBeGreaterThan(0);
      unmount();
    });
  });

  it('handles dither disabled state', () => {
    mockUseEquipmentStore.mockImplementation((selector) => {
      const state = {
        exposureDefaults: {
          exposureTime: 120,
          gain: 100,
          offset: 30,
          binning: '1x1',
          filter: 'L',
          frameCount: 30,
          ditherEnabled: false,
          ditherEvery: 1,
          tracking: 'none',
          targetType: 'galaxy',
          bortle: 5,
        },
        setExposureDefaults: jest.fn(),
      };
      return selector ? selector(state) : state;
    });

    render(<ExposureSettings />);
    expect(screen.getByTestId('switch-dither-enabled')).not.toBeChecked();
  });
});
