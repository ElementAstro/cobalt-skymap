/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';

const mockUseEquipmentStore = jest.fn((selector) => {
  const state = {
    activeCameraId: null,
    activeTelescopeId: null,
    sensorWidth: 23.5,
    sensorHeight: 15.6,
    focalLength: 400,
    pixelSize: 3.76,
    aperture: 80,
    rotationAngle: 0,
    customCameras: [],
    customTelescopes: [],
    applyCamera: jest.fn(),
    applyTelescope: jest.fn(),
    setSensorWidth: jest.fn(),
    setSensorHeight: jest.fn(),
    setFocalLength: jest.fn(),
    setAperture: jest.fn(),
    setPixelSize: jest.fn(),
    setRotationAngle: jest.fn(),
    addCustomCamera: jest.fn(),
    addCustomTelescope: jest.fn(),
    removeCustomCamera: jest.fn(),
    removeCustomTelescope: jest.fn(),
    getFOVWidth: jest.fn(() => 3.37),
    getFOVHeight: jest.fn(() => 2.24),
    getImageScale: jest.fn(() => 1.94),
    getFRatio: jest.fn(() => 5),
  };
  return selector ? selector(state) : state;
});

jest.mock('@/lib/stores', () => ({
  useEquipmentStore: (selector: (state: unknown) => unknown) => mockUseEquipmentStore(selector),
  BUILTIN_CAMERA_PRESETS: [
    { id: 'asi6200', name: 'ASI6200MC Pro', sensorWidth: 36, sensorHeight: 24, pixelSize: 3.76 },
    { id: 'canon-6d', name: 'Canon EOS 6D', sensorWidth: 35.8, sensorHeight: 23.9, pixelSize: 6.55 },
  ],
  BUILTIN_TELESCOPE_PRESETS: [
    { id: 'redcat-51', name: 'RedCat 51', focalLength: 250, aperture: 51, type: 'APO' },
    { id: 'newt-200', name: 'Newton 200/1000', focalLength: 1000, aperture: 200, type: 'Newtonian' },
  ],
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
    <button onClick={onClick} disabled={disabled} data-testid="button">{children}</button>
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
  SelectContent: ({ children }: { children: React.ReactNode }) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div data-testid="select-item">{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="select-trigger">{children}</div>,
  SelectValue: () => <span>Select...</span>,
  SelectGroup: ({ children }: { children: React.ReactNode }) => <div data-testid="select-group">{children}</div>,
  SelectLabel: ({ children }: { children: React.ReactNode }) => <div data-testid="select-label">{children}</div>,
}));

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog">{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-trigger">{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { EquipmentSettings } from '../equipment-settings';

describe('EquipmentSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders equipment settings component', () => {
    render(<EquipmentSettings />);
    expect(screen.getAllByTestId('select').length).toBeGreaterThanOrEqual(2);
  });

  it('renders camera and telescope sections', () => {
    render(<EquipmentSettings />);
    expect(screen.getAllByTestId('separator').length).toBeGreaterThan(0);
  });

  it('renders input fields for manual values', () => {
    render(<EquipmentSettings />);
    expect(screen.getAllByTestId('input').length).toBeGreaterThan(0);
  });

  it('renders rotation angle slider', () => {
    render(<EquipmentSettings />);
    expect(screen.getByTestId('slider')).toBeInTheDocument();
  });

  it('renders calculated FOV info section', () => {
    render(<EquipmentSettings />);
    // Should have labels for FOV calculations
    expect(screen.getAllByTestId('label').length).toBeGreaterThan(0);
  });

  it('renders add camera dialog trigger', () => {
    render(<EquipmentSettings />);
    expect(screen.getAllByTestId('dialog-trigger').length).toBeGreaterThanOrEqual(2);
  });

  it('renders buttons for adding equipment', () => {
    render(<EquipmentSettings />);
    expect(screen.getAllByTestId('button').length).toBeGreaterThan(0);
  });
});

describe('EquipmentSettings edge cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('handles custom cameras in store', () => {
    mockUseEquipmentStore.mockImplementation((selector) => {
      const state = {
        activeCameraId: 'custom-1',
        activeTelescopeId: null,
        sensorWidth: 36,
        sensorHeight: 24,
        focalLength: 400,
        pixelSize: 3.76,
        aperture: 80,
        rotationAngle: 45,
        customCameras: [
          { id: 'custom-1', name: 'My Custom Camera', sensorWidth: 36, sensorHeight: 24, pixelSize: 4.5 }
        ],
        customTelescopes: [],
        applyCamera: jest.fn(),
        applyTelescope: jest.fn(),
        setSensorWidth: jest.fn(),
        setSensorHeight: jest.fn(),
        setFocalLength: jest.fn(),
        setAperture: jest.fn(),
        setPixelSize: jest.fn(),
        setRotationAngle: jest.fn(),
        addCustomCamera: jest.fn(),
        addCustomTelescope: jest.fn(),
        removeCustomCamera: jest.fn(),
        removeCustomTelescope: jest.fn(),
        getFOVWidth: jest.fn(() => 5.15),
        getFOVHeight: jest.fn(() => 3.44),
        getImageScale: jest.fn(() => 2.32),
        getFRatio: jest.fn(() => 5),
      };
      return selector ? selector(state) : state;
    });

    render(<EquipmentSettings />);
    expect(screen.getAllByTestId('badge').length).toBeGreaterThanOrEqual(1);
  });

  it('handles custom telescopes in store', () => {
    mockUseEquipmentStore.mockImplementation((selector) => {
      const state = {
        activeCameraId: null,
        activeTelescopeId: 'custom-scope-1',
        sensorWidth: 23.5,
        sensorHeight: 15.6,
        focalLength: 800,
        pixelSize: 3.76,
        aperture: 200,
        rotationAngle: 0,
        customCameras: [],
        customTelescopes: [
          { id: 'custom-scope-1', name: 'My Newton', focalLength: 800, aperture: 200, type: 'Newtonian' }
        ],
        applyCamera: jest.fn(),
        applyTelescope: jest.fn(),
        setSensorWidth: jest.fn(),
        setSensorHeight: jest.fn(),
        setFocalLength: jest.fn(),
        setAperture: jest.fn(),
        setPixelSize: jest.fn(),
        setRotationAngle: jest.fn(),
        addCustomCamera: jest.fn(),
        addCustomTelescope: jest.fn(),
        removeCustomCamera: jest.fn(),
        removeCustomTelescope: jest.fn(),
        getFOVWidth: jest.fn(() => 1.68),
        getFOVHeight: jest.fn(() => 1.12),
        getImageScale: jest.fn(() => 0.97),
        getFRatio: jest.fn(() => 4),
      };
      return selector ? selector(state) : state;
    });

    render(<EquipmentSettings />);
    expect(screen.getAllByTestId('badge').length).toBeGreaterThanOrEqual(1);
  });

  it('handles extreme rotation angle', () => {
    mockUseEquipmentStore.mockImplementation((selector) => {
      const state = {
        activeCameraId: null,
        activeTelescopeId: null,
        sensorWidth: 23.5,
        sensorHeight: 15.6,
        focalLength: 400,
        pixelSize: 3.76,
        aperture: 80,
        rotationAngle: 180,
        customCameras: [],
        customTelescopes: [],
        applyCamera: jest.fn(),
        applyTelescope: jest.fn(),
        setSensorWidth: jest.fn(),
        setSensorHeight: jest.fn(),
        setFocalLength: jest.fn(),
        setAperture: jest.fn(),
        setPixelSize: jest.fn(),
        setRotationAngle: jest.fn(),
        addCustomCamera: jest.fn(),
        addCustomTelescope: jest.fn(),
        removeCustomCamera: jest.fn(),
        removeCustomTelescope: jest.fn(),
        getFOVWidth: jest.fn(() => 3.37),
        getFOVHeight: jest.fn(() => 2.24),
        getImageScale: jest.fn(() => 1.94),
        getFRatio: jest.fn(() => 5),
      };
      return selector ? selector(state) : state;
    });

    render(<EquipmentSettings />);
    expect(screen.getByTestId('slider')).toBeInTheDocument();
  });

  it('handles zero values gracefully', () => {
    mockUseEquipmentStore.mockImplementation((selector) => {
      const state = {
        activeCameraId: null,
        activeTelescopeId: null,
        sensorWidth: 0,
        sensorHeight: 0,
        focalLength: 0,
        pixelSize: 0,
        aperture: 0,
        rotationAngle: 0,
        customCameras: [],
        customTelescopes: [],
        applyCamera: jest.fn(),
        applyTelescope: jest.fn(),
        setSensorWidth: jest.fn(),
        setSensorHeight: jest.fn(),
        setFocalLength: jest.fn(),
        setAperture: jest.fn(),
        setPixelSize: jest.fn(),
        setRotationAngle: jest.fn(),
        addCustomCamera: jest.fn(),
        addCustomTelescope: jest.fn(),
        removeCustomCamera: jest.fn(),
        removeCustomTelescope: jest.fn(),
        getFOVWidth: jest.fn(() => 0),
        getFOVHeight: jest.fn(() => 0),
        getImageScale: jest.fn(() => 0),
        getFRatio: jest.fn(() => Infinity),
      };
      return selector ? selector(state) : state;
    });

    render(<EquipmentSettings />);
    expect(screen.getAllByTestId('input').length).toBeGreaterThan(0);
  });
});
