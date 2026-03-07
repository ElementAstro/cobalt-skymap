/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';

const mockUseEquipmentStore = jest.fn((selector) => {
  const state = {
    activeTelescopeId: null,
    focalLength: 400,
    aperture: 80,
    customTelescopes: [],
    setFocalLength: jest.fn(),
    setAperture: jest.fn(),
    applyTelescope: jest.fn(),
    addCustomTelescope: jest.fn(),
    removeCustomTelescope: jest.fn(),
  };
  return selector ? selector(state) : state;
});

jest.mock('@/lib/stores', () => ({
  useEquipmentStore: (selector: (state: unknown) => unknown) => mockUseEquipmentStore(selector),
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

import { TelescopeSelector } from '../telescope-selector';

describe('TelescopeSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<TelescopeSelector />);
    expect(screen.getByTestId('select')).toBeInTheDocument();
  });

  it('renders telescope label', () => {
    render(<TelescopeSelector />);
    expect(screen.getAllByTestId('label').length).toBeGreaterThan(0);
  });

  it('renders manual input fields for focal length and aperture', () => {
    render(<TelescopeSelector />);
    const inputs = screen.getAllByTestId('input');
    expect(inputs.length).toBeGreaterThanOrEqual(2);
  });

  it('renders add telescope dialog trigger', () => {
    render(<TelescopeSelector />);
    expect(screen.getByTestId('dialog-trigger')).toBeInTheDocument();
  });

  it('renders select with telescope type groups', () => {
    render(<TelescopeSelector />);
    expect(screen.getAllByTestId('select-group').length).toBeGreaterThan(0);
  });

  it('renders custom telescopes as badges when present', () => {
    mockUseEquipmentStore.mockImplementation((selector) => {
      const state = {
        activeTelescopeId: 'custom-scope-1',
        focalLength: 800,
        aperture: 200,
        customTelescopes: [
          { id: 'custom-scope-1', name: 'My Newton', focalLength: 800, aperture: 200, type: 'Newtonian' },
        ],
        setFocalLength: jest.fn(),
        setAperture: jest.fn(),
        applyTelescope: jest.fn(),
        addCustomTelescope: jest.fn(),
        removeCustomTelescope: jest.fn(),
      };
      return selector ? selector(state) : state;
    });

    render(<TelescopeSelector />);
    expect(screen.getAllByTestId('badge').length).toBeGreaterThanOrEqual(1);
  });
});
