/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { AppearanceSettings } from '../appearance-settings';

const mockSetTheme = jest.fn();
const mockSetRadius = jest.fn();
const mockSetFontFamily = jest.fn();
const mockSetFontSize = jest.fn();
const mockSetAnimationsEnabled = jest.fn();
const mockSetActivePreset = jest.fn();
const mockSetCustomColor = jest.fn();
const mockClearCustomColor = jest.fn();

jest.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'dark',
    setTheme: mockSetTheme,
    resolvedTheme: 'dark',
  }),
}));

jest.mock('@/lib/stores/theme-store', () => ({
  useThemeStore: () => ({
    customization: {
      radius: 0.5,
      fontFamily: 'default',
      fontSize: 'default',
      animationsEnabled: true,
      activePreset: 'default',
      customColors: {
        light: { primary: '#fafafa' },
        dark: { primary: '#101010' },
      },
    },
    setRadius: mockSetRadius,
    setFontFamily: mockSetFontFamily,
    setFontSize: mockSetFontSize,
    setAnimationsEnabled: mockSetAnimationsEnabled,
    setActivePreset: mockSetActivePreset,
    setCustomColor: mockSetCustomColor,
    clearCustomColor: mockClearCustomColor,
  }),
  customizableThemeColorKeys: [
    'primary',
    'secondary',
    'accent',
    'background',
    'foreground',
    'muted',
    'card',
    'border',
    'destructive',
  ],
  themePresets: [
    {
      id: 'default',
      name: 'Default',
      colors: {
        light: { primary: '#eeeeee', secondary: '#cccccc', accent: '#bbbbbb' },
        dark: { primary: '#222222', secondary: '#444444', accent: '#666666' },
      },
    },
  ],
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, type = 'button', disabled, className, variant }: {
    children: React.ReactNode;
    onClick?: () => void;
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    className?: string;
    variant?: string;
  }) => (
    <button type={type} disabled={disabled} onClick={onClick} className={className} data-variant={variant}>
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, onBlur, onKeyDown, placeholder, className, 'aria-invalid': ariaInvalid }: {
    value?: string;
    onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onBlur?: () => void;
    onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
    placeholder?: string;
    className?: string;
    'aria-invalid'?: boolean;
  }) => (
    <input
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      className={className}
      aria-invalid={ariaInvalid}
    />
  ),
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, className }: { children: React.ReactNode; className?: string }) => <label className={className}>{children}</label>,
}));

jest.mock('@/components/ui/separator', () => ({
  Separator: () => <hr data-testid="separator" />,
}));

jest.mock('@/components/ui/slider', () => ({
  Slider: ({ value, onValueChange }: { value: number[]; onValueChange: (next: number[]) => void }) => (
    <input
      type="range"
      value={value[0]}
      onChange={(event) => onValueChange([Number(event.target.value)])}
    />
  ),
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <option>{children}</option>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span>select</span>,
}));

jest.mock('../settings-shared', () => ({
  SettingsSection: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section>
      <h3>{title}</h3>
      {children}
    </section>
  ),
  ToggleItem: ({ id, label, checked, onCheckedChange }: {
    id: string;
    label: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
  }) => (
    <label htmlFor={id}>
      {label}
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
      />
    </label>
  ),
}));

describe('AppearanceSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders editable rows for all customizable colors', () => {
    render(<AppearanceSettings />);
    expect(screen.getAllByPlaceholderText('theme.colorValuePlaceholder')).toHaveLength(9);
  });

  it('commits valid color values to current editing mode', () => {
    render(<AppearanceSettings />);

    const inputs = screen.getAllByPlaceholderText('theme.colorValuePlaceholder');
    fireEvent.change(inputs[0], { target: { value: '#123456' } });
    fireEvent.blur(inputs[0]);

    expect(mockSetCustomColor).toHaveBeenCalledWith('dark', 'primary', '#123456');
  });

  it('can switch editing mode and write to light palette', () => {
    render(<AppearanceSettings />);

    const lightButtons = screen.getAllByRole('radio', { name: 'settingsNew.appearance.light' });
    fireEvent.click(lightButtons[lightButtons.length - 1]);
    const inputs = screen.getAllByPlaceholderText('theme.colorValuePlaceholder');
    fireEvent.change(inputs[0], { target: { value: '#abcdef' } });
    fireEvent.blur(inputs[0]);

    expect(mockSetCustomColor).toHaveBeenCalledWith('light', 'primary', '#abcdef');
  });

  it('shows error for invalid CSS colors and does not persist', () => {
    render(<AppearanceSettings />);

    const inputs = screen.getAllByPlaceholderText('theme.colorValuePlaceholder');
    fireEvent.change(inputs[0], { target: { value: 'not-a-valid-color' } });
    fireEvent.blur(inputs[0]);

    expect(screen.getByText('theme.invalidColor')).toBeInTheDocument();
    expect(mockSetCustomColor).not.toHaveBeenCalled();
  });

  it('clears custom color override for current mode', () => {
    render(<AppearanceSettings />);

    const clearButtons = screen.getAllByText('theme.clearColor');
    fireEvent.click(clearButtons[0]);

    expect(mockClearCustomColor).toHaveBeenCalledWith('dark', 'primary');
  });

  it('toggles animations setting', () => {
    render(<AppearanceSettings />);

    fireEvent.click(screen.getByRole('switch'));
    expect(mockSetAnimationsEnabled).toHaveBeenCalledWith(false);
  });
});
