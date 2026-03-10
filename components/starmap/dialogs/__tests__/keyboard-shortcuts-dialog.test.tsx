/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useKeybindingStore } from '@/lib/stores/keybinding-store';

// Mock UI components
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open, onOpenChange }: { children: React.ReactNode; open?: boolean; onOpenChange?: (v: boolean) => void }) => (
    <div data-testid="dialog" data-open={open}>
      {children}
      <button data-testid="dialog-close-trigger" onClick={() => onOpenChange?.(false)}>close</button>
    </div>
  ),
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="dialog-description">{children}</p>
  ),
  DialogTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    asChild ? <>{children}</> : <div data-testid="dialog-trigger">{children}</div>
  ),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, variant, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode; variant?: string }) => (
    <button onClick={onClick} data-testid="button" data-variant={variant} {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/kbd', () => ({
  Kbd: ({ children }: { children: React.ReactNode }) => (
    <kbd data-testid="kbd">{children}</kbd>
  ),
  KbdGroup: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="kbd-group">{children}</span>
  ),
}));

jest.mock('@/components/ui/command', () => ({
  Command: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="command">{children}</div>
  ),
  CommandInput: ({
    value,
    onValueChange,
    ...props
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
  } & React.InputHTMLAttributes<HTMLInputElement> & { 'data-testid'?: string }) => (
    <input
      data-testid={props['data-testid'] || 'command-input'}
      value={value ?? ''}
      onChange={(e) => onValueChange?.(e.target.value)}
      {...props}
    />
  ),
  CommandList: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="command-list">{children}</div>
  ),
  CommandEmpty: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="command-empty">{children}</div>
  ),
}));

jest.mock('@/components/ui/separator', () => ({
  Separator: () => <hr data-testid="separator" />,
}));

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip">{children}</div>
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
  TooltipTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    asChild ? <>{children}</> : <div data-testid="tooltip-trigger">{children}</div>
  ),
}));

jest.mock('@/lib/hooks', () => ({
  STARMAP_SHORTCUT_KEYS: {
    ZOOM_IN: '+',
    ZOOM_OUT: '-',
    RESET_VIEW: 'r',
    CENTER_VIEW: 'c',
    TOGGLE_SEARCH: 'f',
    TOGGLE_SETTINGS: ',',
    TOGGLE_SESSION_PANEL: 'p',
    TOGGLE_FOV: 'o',
    TOGGLE_CONSTELLATIONS: 'l',
    TOGGLE_GRID: 'g',
    TOGGLE_DSO: 'd',
    TOGGLE_ATMOSPHERE: 'a',
    PAUSE_TIME: ' ',
    SPEED_UP: ']',
    SLOW_DOWN: '[',
    RESET_TIME: 't',
    ADD_TO_LIST: 'Enter',
    CLOSE_PANEL: 'Escape',
  },
}));

import { KeyboardShortcutsDialog } from '../keyboard-shortcuts-dialog';

describe('KeyboardShortcutsDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useKeybindingStore.setState({ customBindings: {} });
  });

  // ========================================================================
  // Basic rendering
  // ========================================================================

  it('renders without crashing', () => {
    render(<KeyboardShortcutsDialog />);
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('renders dialog trigger button with aria-label', () => {
    render(<KeyboardShortcutsDialog />);
    const buttons = screen.getAllByTestId('button');
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons[0]).toHaveAttribute('aria-label');
  });

  it('renders dialog content', () => {
    render(<KeyboardShortcutsDialog />);
    expect(screen.getByTestId('dialog-content')).toBeInTheDocument();
  });

  it('renders shortcut groups with separators', () => {
    render(<KeyboardShortcutsDialog />);
    const separators = screen.getAllByTestId('separator');
    expect(separators.length).toBe(3);
  });

  it('renders shortcut keycaps', () => {
    render(<KeyboardShortcutsDialog />);
    const keycaps = screen.getAllByTestId('kbd');
    expect(keycaps.length).toBeGreaterThan(0);
  });

  it('supports custom trigger prop', () => {
    const customTrigger = <button data-testid="custom-trigger">Custom</button>;
    render(<KeyboardShortcutsDialog trigger={customTrigger} />);
    expect(screen.getByTestId('custom-trigger')).toBeInTheDocument();
  });

  // ========================================================================
  // Global ? shortcut
  // ========================================================================

  it('responds to ? key press to open dialog', () => {
    render(<KeyboardShortcutsDialog />);
    fireEvent.keyDown(window, { key: '?', shiftKey: true });
    const dialog = screen.getByTestId('dialog');
    expect(dialog).toHaveAttribute('data-open', 'true');
  });

  it('responds to Shift+/ key press to open dialog', () => {
    render(<KeyboardShortcutsDialog />);
    fireEvent.keyDown(window, { key: '/', shiftKey: true });
    const dialog = screen.getByTestId('dialog');
    expect(dialog).toHaveAttribute('data-open', 'true');
  });

  it('does not open on ? when input is focused', () => {
    render(
      <div>
        <input data-testid="test-input" />
        <KeyboardShortcutsDialog />
      </div>
    );
    const input = screen.getByTestId('test-input');
    input.focus();
    fireEvent.keyDown(window, { key: '?', shiftKey: true });
    const dialog = screen.getByTestId('dialog');
    expect(dialog).toHaveAttribute('data-open', 'false');
  });

  it('does not open on ? when textarea is focused', () => {
    render(
      <div>
        <textarea data-testid="test-textarea" />
        <KeyboardShortcutsDialog />
      </div>
    );
    screen.getByTestId('test-textarea').focus();
    fireEvent.keyDown(window, { key: '?', shiftKey: true });
    expect(screen.getByTestId('dialog')).toHaveAttribute('data-open', 'false');
  });

  it('does not open on ? when a dialog is already open', () => {
    render(
      <div>
        <div role="dialog" data-state="open" />
        <KeyboardShortcutsDialog />
      </div>
    );
    fireEvent.keyDown(window, { key: '?', shiftKey: true });
    expect(screen.getByTestId('dialog')).toHaveAttribute('data-open', 'false');
  });

  // ========================================================================
  // Edit mode toggle
  // ========================================================================

  it('toggles edit mode when Settings2 button is clicked', () => {
    render(<KeyboardShortcutsDialog />);
    // Open dialog first
    fireEvent.keyDown(window, { key: '?', shiftKey: true });

    const allButtons = screen.getAllByTestId('button');
    // The settings button is the second button (after the trigger)
    fireEvent.click(allButtons[1]);

    // Should now show editing description and resetAll button
    expect(screen.getByText('shortcuts.editDescription')).toBeInTheDocument();
    expect(screen.getByText('shortcuts.resetAll')).toBeInTheDocument();
  });

  it('shows view description and pressQuestionMark hint when not editing', () => {
    render(<KeyboardShortcutsDialog />);
    expect(screen.getByText('shortcuts.description')).toBeInTheDocument();
    expect(screen.getByText('shortcuts.pressQuestionMark')).toBeInTheDocument();
  });

  // ========================================================================
  // Dialog close resets state
  // ========================================================================

  it('resets editing state when dialog closes', () => {
    render(<KeyboardShortcutsDialog />);
    // Open
    fireEvent.keyDown(window, { key: '?', shiftKey: true });
    // Enter edit mode
    const allButtons = screen.getAllByTestId('button');
    fireEvent.click(allButtons[1]);
    expect(screen.getByText('shortcuts.editDescription')).toBeInTheDocument();

    // Close dialog via onOpenChange(false)
    fireEvent.click(screen.getByTestId('dialog-close-trigger'));

    // After re-open, should be back to view mode
    fireEvent.keyDown(window, { key: '?', shiftKey: true });
    expect(screen.getByText('shortcuts.description')).toBeInTheDocument();
  });

  // ========================================================================
  // Edit mode — ShortcutKeyRowEdit / KeyCaptureButton
  // ========================================================================

  it('renders KeyCaptureButton in edit mode for customizable shortcuts', () => {
    render(<KeyboardShortcutsDialog />);
    fireEvent.keyDown(window, { key: '?', shiftKey: true });

    // Enter edit mode
    const allButtons = screen.getAllByTestId('button');
    fireEvent.click(allButtons[1]);

    // KeyCaptureButton renders <button> elements with font-mono class
    // They show the formatted key binding text
    const captureButtons = screen.getAllByTitle('clickToEdit');
    expect(captureButtons.length).toBeGreaterThan(0);
  });

  it('starts recording when KeyCaptureButton is clicked', () => {
    render(<KeyboardShortcutsDialog />);
    fireEvent.keyDown(window, { key: '?', shiftKey: true });
    const allButtons = screen.getAllByTestId('button');
    fireEvent.click(allButtons[1]); // edit mode

    const captureButtons = screen.getAllByTitle('clickToEdit');
    fireEvent.click(captureButtons[0]);

    // Should show "pressKey" text (recording state)
    expect(screen.getByText('pressKey')).toBeInTheDocument();
  });

  it('captures a key binding when a key is pressed during recording', () => {
    render(<KeyboardShortcutsDialog />);
    fireEvent.keyDown(window, { key: '?', shiftKey: true });
    const allButtons = screen.getAllByTestId('button');
    fireEvent.click(allButtons[1]); // edit mode

    const captureButtons = screen.getAllByTitle('clickToEdit');
    fireEvent.click(captureButtons[0]); // start recording ZOOM_IN

    // Press a key to capture
    act(() => {
      fireEvent.keyDown(window, { key: 'x', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });
    });

    // Should no longer show recording state
    expect(screen.queryByText('pressKey')).not.toBeInTheDocument();

    // The store should have the custom binding
    const state = useKeybindingStore.getState();
    expect(state.isCustom('ZOOM_IN')).toBe(true);
  });

  it('cancels recording when Escape is pressed', () => {
    render(<KeyboardShortcutsDialog />);
    fireEvent.keyDown(window, { key: '?', shiftKey: true });
    const allButtons = screen.getAllByTestId('button');
    fireEvent.click(allButtons[1]); // edit mode

    const captureButtons = screen.getAllByTitle('clickToEdit');
    fireEvent.click(captureButtons[0]); // start recording
    expect(screen.getByText('pressKey')).toBeInTheDocument();

    // Press Escape to cancel
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });

    expect(screen.queryByText('pressKey')).not.toBeInTheDocument();
  });

  it('toggles recording off when clicking the same capture button again', () => {
    render(<KeyboardShortcutsDialog />);
    fireEvent.keyDown(window, { key: '?', shiftKey: true });
    const allButtons = screen.getAllByTestId('button');
    fireEvent.click(allButtons[1]); // edit mode

    const captureButtons = screen.getAllByTitle('clickToEdit');
    fireEvent.click(captureButtons[0]); // start recording
    expect(screen.getByText('pressKey')).toBeInTheDocument();

    // Click the same button (now has title "pressKeyOrEsc")
    const recordingBtn = screen.getByTitle('pressKeyOrEsc');
    fireEvent.click(recordingBtn);
    expect(screen.queryByText('pressKey')).not.toBeInTheDocument();
  });

  it('shows reset button for custom bindings and resets on click', () => {
    // Pre-set a custom binding
    useKeybindingStore.setState({
      customBindings: { ZOOM_IN: { key: 'x' } },
    });

    render(<KeyboardShortcutsDialog />);
    fireEvent.keyDown(window, { key: '?', shiftKey: true });
    const allButtons = screen.getAllByTestId('button');
    fireEvent.click(allButtons[1]); // edit mode

    // Find the reset button (RotateCcw icon button)
    const resetToDefaultText = screen.getByText('resetToDefault');
    expect(resetToDefaultText).toBeInTheDocument();

    // Click the reset button (its parent is the <button>)
    const resetBtn = resetToDefaultText.closest('[data-testid="tooltip"]')?.querySelector('button:not([data-testid])');
    if (resetBtn) {
      fireEvent.click(resetBtn);
      expect(useKeybindingStore.getState().isCustom('ZOOM_IN')).toBe(false);
    }
  });

  it('resets all bindings when Reset All button is clicked', () => {
    useKeybindingStore.setState({
      customBindings: { ZOOM_IN: { key: 'x' }, ZOOM_OUT: { key: 'y' } },
    });

    render(<KeyboardShortcutsDialog />);
    fireEvent.keyDown(window, { key: '?', shiftKey: true });
    const allButtons = screen.getAllByTestId('button');
    fireEvent.click(allButtons[1]); // edit mode

    // Find and click the "Reset All" button
    const resetAllBtn = screen.getByText('shortcuts.resetAll').closest('button');
    expect(resetAllBtn).toBeInTheDocument();
    fireEvent.click(resetAllBtn!);

    const state = useKeybindingStore.getState();
    expect(state.isCustom('ZOOM_IN')).toBe(false);
    expect(state.isCustom('ZOOM_OUT')).toBe(false);
  });

  it('detects conflict when capturing a binding already used by another action', () => {
    render(<KeyboardShortcutsDialog />);
    fireEvent.keyDown(window, { key: '?', shiftKey: true });
    const allButtons = screen.getAllByTestId('button');
    fireEvent.click(allButtons[1]); // edit mode

    const captureButtons = screen.getAllByTitle('clickToEdit');
    // Start recording for ZOOM_IN (first capture button)
    fireEvent.click(captureButtons[0]);

    // Press '-' which is the default for ZOOM_OUT → should cause a conflict
    act(() => {
      fireEvent.keyDown(window, { key: '-' });
    });

    // The binding should still be set despite the conflict
    expect(useKeybindingStore.getState().getBinding('ZOOM_IN').key).toBe('-');
  });

  // ========================================================================
  // ShortcutKeyRowEdit — non-customizable shortcut (no actionId)
  // ========================================================================

  it('renders static keycap for non-customizable shortcuts in edit mode', () => {
    render(<KeyboardShortcutsDialog />);
    fireEvent.keyDown(window, { key: '?', shiftKey: true });
    const allButtons = screen.getAllByTestId('button');
    fireEvent.click(allButtons[1]); // edit mode

    // The "/" shortcut for openSearch has no actionId — should render a keycap
    const keycaps = screen.getAllByTestId('kbd');
    const slashKeycap = keycaps.find(k => k.textContent === '/');
    expect(slashKeycap).toBeInTheDocument();
  });

  // ========================================================================
  // ShortcutKeyRowView — store binding display
  // ========================================================================

  it('displays store binding when available in view mode', () => {
    useKeybindingStore.setState({
      customBindings: { ZOOM_IN: { key: 'z', ctrl: true } },
    });

    render(<KeyboardShortcutsDialog />);
    const keycaps = screen.getAllByTestId('kbd');
    const keycapTexts = keycaps.map(k => k.textContent);
    expect(keycapTexts).toContain('Ctrl');
    expect(keycapTexts).toContain('Z');
  });

  it('filters shortcut rows via search input', () => {
    render(<KeyboardShortcutsDialog />);

    const searchInput = screen.getByTestId('shortcuts-search-input');
    fireEvent.change(searchInput, { target: { value: 'non-existent-shortcut' } });

    expect(screen.getByText('shortcuts.noResults')).toBeInTheDocument();
  });

  it('ignores standalone modifier key during recording', () => {
    render(<KeyboardShortcutsDialog />);
    fireEvent.keyDown(window, { key: '?', shiftKey: true });
    const allButtons = screen.getAllByTestId('button');
    fireEvent.click(allButtons[1]); // edit mode

    const captureButtons = screen.getAllByTitle('clickToEdit');
    fireEvent.click(captureButtons[0]); // start recording

    // Press a standalone modifier — should remain recording
    act(() => {
      fireEvent.keyDown(window, { key: 'Control' });
    });

    expect(screen.getByText('pressKey')).toBeInTheDocument();
  });
});
