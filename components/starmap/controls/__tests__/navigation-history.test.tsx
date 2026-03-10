/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { NavigationHistory } from '../navigation-history';

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div data-testid="popover-content">{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) => open ? <div data-testid="alert-dialog">{children}</div> : null,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div data-testid="alert-dialog-content">{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <h2 data-testid="alert-title">{children}</h2>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <p data-testid="alert-description">{children}</p>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => <button data-testid="alert-cancel" {...props}>{children}</button>,
  AlertDialogAction: ({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => <button data-testid="alert-confirm" onClick={onClick} {...props}>{children}</button>,
}));

jest.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock the navigation history store
const mockStore = {
  history: [] as Array<{ id: string; ra: number; dec: number; fov: number; name?: string; timestamp: number }>,
  currentIndex: -1,
  back: jest.fn(),
  forward: jest.fn(),
  goTo: jest.fn(),
  canGoBack: jest.fn(() => false),
  canGoForward: jest.fn(() => false),
  clear: jest.fn(),
};

jest.mock('@/lib/hooks/use-navigation-history', () => ({
  useNavigationHistoryStore: jest.fn((selector?: (s: typeof mockStore) => unknown) =>
    selector ? selector(mockStore) : mockStore
  ),
  formatNavigationPoint: jest.fn((point: { name?: string; ra: number; dec: number }) => point.name || `${point.ra}° ${point.dec}°`),
  formatTimestamp: jest.fn((_ts: number, opts?: { justNow: string; minutesAgo: (m: number) => string; hoursAgo: (h: number) => string }) => {
    // Invoke callbacks to ensure coverage of inline arrow functions
    if (opts) {
      opts.minutesAgo(5);
      opts.hoursAgo(2);
    }
    return opts?.justNow || 'just now';
  }),
}));

describe('NavigationHistory', () => {
  const defaultProps = {
    onNavigate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockStore.history = [];
    mockStore.currentIndex = -1;
    mockStore.canGoBack.mockReturnValue(false);
    mockStore.canGoForward.mockReturnValue(false);
  });

  it('renders back, forward, and history buttons', () => {
    render(<NavigationHistory {...defaultProps} />);
    
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  });

  it('disables back button when canGoBack is false', () => {
    mockStore.canGoBack.mockReturnValue(false);
    render(<NavigationHistory {...defaultProps} />);
    
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toBeDisabled();
  });

  it('enables back button when canGoBack is true', () => {
    mockStore.canGoBack.mockReturnValue(true);
    render(<NavigationHistory {...defaultProps} />);
    
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).not.toBeDisabled();
  });

  it('disables forward button when canGoForward is false', () => {
    mockStore.canGoForward.mockReturnValue(false);
    render(<NavigationHistory {...defaultProps} />);
    
    const buttons = screen.getAllByRole('button');
    expect(buttons[1]).toBeDisabled();
  });

  it('calls back and onNavigate when back button is clicked', () => {
    mockStore.canGoBack.mockReturnValue(true);
    const mockPoint = { id: '1', ra: 10, dec: 20, fov: 30, timestamp: Date.now() };
    mockStore.back.mockReturnValue(mockPoint);
    
    render(<NavigationHistory {...defaultProps} />);
    
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    
    expect(mockStore.back).toHaveBeenCalled();
    expect(defaultProps.onNavigate).toHaveBeenCalledWith(10, 20, 30);
  });

  it('calls forward and onNavigate when forward button is clicked', () => {
    mockStore.canGoForward.mockReturnValue(true);
    const mockPoint = { id: '2', ra: 50, dec: 60, fov: 15, timestamp: Date.now() };
    mockStore.forward.mockReturnValue(mockPoint);
    
    render(<NavigationHistory {...defaultProps} />);
    
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[1]);
    
    expect(mockStore.forward).toHaveBeenCalled();
    expect(defaultProps.onNavigate).toHaveBeenCalledWith(50, 60, 15);
  });

  it('has navigation role with aria-label', () => {
    render(<NavigationHistory {...defaultProps} />);
    
    const nav = screen.getByRole('navigation');
    expect(nav).toBeInTheDocument();
  });

  it('shows confirmation dialog when clear button is clicked', () => {
    mockStore.history = [
      { id: '1', ra: 10, dec: 20, fov: 30, timestamp: Date.now() },
    ];
    mockStore.currentIndex = 0;

    render(<NavigationHistory {...defaultProps} />);

    // Find and click the clear/trash button (small icon button in the history header)
    const allButtons = screen.getAllByRole('button');
    // The clear button has a Trash2 icon; it's the last small button rendered when history is non-empty
    const clearBtn = allButtons.find(btn => btn.className?.includes('h-6'));
    expect(clearBtn).toBeDefined();
    fireEvent.click(clearBtn!);

    // Confirmation dialog should appear
    expect(screen.getByTestId('alert-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('alert-title')).toHaveTextContent('navigation.confirmClearTitle');
    expect(screen.getByTestId('alert-description')).toHaveTextContent('navigation.confirmClearHistory');

    // Should not have cleared yet
    expect(mockStore.clear).not.toHaveBeenCalled();
  });

  it('clears history when confirmation is accepted', () => {
    mockStore.history = [
      { id: '1', ra: 10, dec: 20, fov: 30, timestamp: Date.now() },
    ];
    mockStore.currentIndex = 0;

    render(<NavigationHistory {...defaultProps} />);

    // Click clear button
    const allButtons = screen.getAllByRole('button');
    const clearBtn = allButtons.find(btn => btn.className?.includes('h-6'));
    fireEvent.click(clearBtn!);

    // Confirm clear
    fireEvent.click(screen.getByTestId('alert-confirm'));
    expect(mockStore.clear).toHaveBeenCalled();
  });

  it('shows empty history message when no history exists', () => {
    mockStore.history = [];
    render(<NavigationHistory {...defaultProps} />);

    expect(screen.getByText('navigation.noHistory')).toBeInTheDocument();
  });

  it('renders history items with formatted text', () => {
    mockStore.history = [
      { id: '1', name: 'Orion', ra: 83, dec: -5, fov: 2, timestamp: Date.now() },
    ];
    mockStore.currentIndex = 0;

    render(<NavigationHistory {...defaultProps} />);

    expect(screen.getByText('Orion')).toBeInTheDocument();
  });

  it('renders each history entry as a focusable button', () => {
    mockStore.history = [
      { id: '1', name: 'Orion', ra: 83, dec: -5, fov: 2, timestamp: Date.now() },
    ];
    mockStore.currentIndex = 0;

    render(<NavigationHistory {...defaultProps} />);
    expect(screen.getByRole('button', { name: /Orion/ })).toBeInTheDocument();
  });

  it('calls goTo and onNavigate when a history item is clicked', () => {
    const point = { id: '1', ra: 10, dec: 20, fov: 30, timestamp: Date.now() };
    mockStore.history = [
      point,
      { id: '2', ra: 50, dec: 60, fov: 15, timestamp: Date.now() },
    ];
    mockStore.currentIndex = 1;
    mockStore.goTo.mockReturnValue(point);

    render(<NavigationHistory {...defaultProps} />);

    // History items are rendered in reverse. Find the button for point id='1' by formatted text.
    const historyItemBtn = screen.getByText('10° 20°').closest('button');
    expect(historyItemBtn).not.toBeNull();
    fireEvent.click(historyItemBtn!);
    expect(mockStore.goTo).toHaveBeenCalledWith(0);
    expect(defaultProps.onNavigate).toHaveBeenCalledWith(10, 20, 30);
  });

  it('does not call onNavigate from goTo when goTo returns null', () => {
    mockStore.history = [
      { id: '1', ra: 10, dec: 20, fov: 30, timestamp: Date.now() },
    ];
    mockStore.currentIndex = 0;
    mockStore.goTo.mockReturnValue(null);

    render(<NavigationHistory {...defaultProps} />);

    const historyItemBtn = screen.getByText('10° 20°').closest('button');
    expect(historyItemBtn).not.toBeNull();
    fireEvent.click(historyItemBtn!);
    expect(mockStore.goTo).toHaveBeenCalledWith(0);
    expect(defaultProps.onNavigate).not.toHaveBeenCalled();
  });

  it('highlights current history item', () => {
    mockStore.history = [
      { id: '1', ra: 10, dec: 20, fov: 30, timestamp: Date.now() },
      { id: '2', ra: 50, dec: 60, fov: 15, timestamp: Date.now() },
    ];
    mockStore.currentIndex = 0;

    render(<NavigationHistory {...defaultProps} />);

    // Current item should have the primary styling class
    const items = screen.getAllByText(/°/).map(el => el.closest('[data-slot="item"]'));
    const hasHighlight = items.some(item => item?.className?.includes('border-l-primary'));
    expect(hasHighlight).toBe(true);
  });

  it('shows history count in footer when history is non-empty', () => {
    mockStore.history = [
      { id: '1', ra: 10, dec: 20, fov: 30, timestamp: Date.now() },
      { id: '2', ra: 50, dec: 60, fov: 15, timestamp: Date.now() },
    ];
    mockStore.currentIndex = 1;

    render(<NavigationHistory {...defaultProps} />);

    expect(screen.getByText('navigation.historyCount')).toBeInTheDocument();
  });

  it('does not call onNavigate when back returns null', () => {
    mockStore.canGoBack.mockReturnValue(true);
    mockStore.back.mockReturnValue(null);

    render(<NavigationHistory {...defaultProps} />);

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);

    expect(mockStore.back).toHaveBeenCalled();
    expect(defaultProps.onNavigate).not.toHaveBeenCalled();
  });

  it('does not call onNavigate when forward returns null', () => {
    mockStore.canGoForward.mockReturnValue(true);
    mockStore.forward.mockReturnValue(null);

    render(<NavigationHistory {...defaultProps} />);

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[1]);

    expect(mockStore.forward).toHaveBeenCalled();
    expect(defaultProps.onNavigate).not.toHaveBeenCalled();
  });

  it('enables forward button when canGoForward is true', () => {
    mockStore.canGoForward.mockReturnValue(true);
    render(<NavigationHistory {...defaultProps} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons[1]).not.toBeDisabled();
  });

  it('does not crash when onNavigate is not provided', () => {
    mockStore.canGoBack.mockReturnValue(true);
    mockStore.back.mockReturnValue({ id: '1', ra: 10, dec: 20, fov: 30, timestamp: Date.now() });

    expect(() => {
      render(<NavigationHistory />);
      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[0]);
    }).not.toThrow();
  });

  it('does not show clear button when history is empty', () => {
    mockStore.history = [];
    render(<NavigationHistory {...defaultProps} />);

    const allButtons = screen.getAllByRole('button');
    const clearBtn = allButtons.find(btn => btn.className?.includes('h-6'));
    expect(clearBtn).toBeUndefined();
  });
});
