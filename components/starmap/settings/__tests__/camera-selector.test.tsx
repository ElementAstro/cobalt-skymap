/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';

const mockUseEquipmentStore = jest.fn((selector) => {
  const state = {
    activeCameraId: null,
    sensorWidth: 23.5,
    sensorHeight: 15.6,
    pixelSize: 3.76,
    customCameras: [],
    setSensorWidth: jest.fn(),
    setSensorHeight: jest.fn(),
    setPixelSize: jest.fn(),
    applyCamera: jest.fn(),
    addCustomCamera: jest.fn(),
    removeCustomCamera: jest.fn(),
  };
  return selector ? selector(state) : state;
});

jest.mock('@/lib/stores', () => ({
  useEquipmentStore: (selector: (state: unknown) => unknown) => mockUseEquipmentStore(selector),
  BUILTIN_CAMERA_PRESETS: [
    { id: 'asi6200', name: 'ASI6200MC Pro', sensorWidth: 36, sensorHeight: 24, pixelSize: 3.76 },
    { id: 'canon-6d', name: 'Canon EOS 6D', sensorWidth: 35.8, sensorHeight: 23.9, pixelSize: 6.55 },
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

import { CameraSelector } from '../camera-selector';

describe('CameraSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<CameraSelector />);
    expect(screen.getByTestId('select')).toBeInTheDocument();
  });

  it('renders camera label', () => {
    render(<CameraSelector />);
    expect(screen.getAllByTestId('label').length).toBeGreaterThan(0);
  });

  it('renders manual input fields for sensor width, height, pixel size', () => {
    render(<CameraSelector />);
    const inputs = screen.getAllByTestId('input');
    expect(inputs.length).toBeGreaterThanOrEqual(3);
  });

  it('renders add camera dialog trigger', () => {
    render(<CameraSelector />);
    expect(screen.getByTestId('dialog-trigger')).toBeInTheDocument();
  });

  it('renders select with camera options', () => {
    render(<CameraSelector />);
    expect(screen.getAllByTestId('select-group').length).toBeGreaterThan(0);
  });

  it('renders custom cameras as badges when present', () => {
    mockUseEquipmentStore.mockImplementation((selector) => {
      const state = {
        activeCameraId: 'custom-1',
        sensorWidth: 36,
        sensorHeight: 24,
        pixelSize: 4.5,
        customCameras: [
          { id: 'custom-1', name: 'My Camera', sensorWidth: 36, sensorHeight: 24, pixelSize: 4.5 },
        ],
        setSensorWidth: jest.fn(),
        setSensorHeight: jest.fn(),
        setPixelSize: jest.fn(),
        applyCamera: jest.fn(),
        addCustomCamera: jest.fn(),
        removeCustomCamera: jest.fn(),
      };
      return selector ? selector(state) : state;
    });

    render(<CameraSelector />);
    expect(screen.getAllByTestId('badge').length).toBeGreaterThanOrEqual(1);
  });
});
