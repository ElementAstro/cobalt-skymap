/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';

// Mock stores
const mockUseMountStore = jest.fn((selector) => {
  const state = {
    profileInfo: {
      AstrometrySettings: {
        Latitude: 40.7128,
        Longitude: -74.006,
      },
    },
  };
  return selector ? selector(state) : state;
});

const mockUseStellariumStore = jest.fn((selector) => {
  const state = {
    setViewDirection: jest.fn(),
  };
  return selector ? selector(state) : state;
});

const mockUseEventSourcesStore = jest.fn((selector) => {
  const state = {
    sources: [
      { id: 'usno', name: 'USNO', apiUrl: '', apiKey: '', enabled: true, priority: 1, cacheMinutes: 60 },
      { id: 'imo', name: 'IMO', apiUrl: '', apiKey: '', enabled: true, priority: 2, cacheMinutes: 60 },
    ],
    toggleSource: jest.fn(),
  };
  return selector ? selector(state) : state;
});

jest.mock('@/lib/stores', () => ({
  useMountStore: (selector: (state: unknown) => unknown) => mockUseMountStore(selector),
  useStellariumStore: (selector: (state: unknown) => unknown) => mockUseStellariumStore(selector),
  useEventSourcesStore: (selector: (state: unknown) => unknown) => mockUseEventSourcesStore(selector),
}));

// Mock astro-data-sources
jest.mock('@/lib/services/astro-data-sources', () => ({
  fetchDailyAstroEvents: jest.fn(() => Promise.resolve({
    date: new Date(),
    timezone: 'Etc/UTC',
    events: [],
    fetchedAt: new Date(),
    sourceBreakdown: {},
  })),
  fetchAstroEventsInRange: jest.fn(() => Promise.resolve([])),
}));

jest.mock('@/lib/tauri/hooks', () => ({
  useAstroEvents: () => ({
    getDailyEvents: jest.fn(() => Promise.resolve([])),
  }),
}));

jest.mock('@/lib/storage/platform', () => ({
  isTauri: jest.fn(() => false),
}));

// Mock event-detail-dialog
jest.mock('../event-detail-dialog', () => ({
  EventDetailDialog: ({ open }: { open: boolean }) => (
    open ? <div data-testid="event-detail-dialog">Detail</div> : null
  ),
}));

jest.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

// Mock UI components
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog">{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2 data-testid="dialog-title">{children}</h2>,
  DialogTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    asChild ? <>{children}</> : <div data-testid="dialog-trigger">{children}</div>
  ),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
    <button onClick={onClick} data-testid="button" {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div data-testid="scroll-area">{children}</div>,
}));

jest.mock('@/components/ui/separator', () => ({
  Separator: () => <hr data-testid="separator" />,
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div data-testid="card-content">{children}</div>,
}));

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip">{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip-content">{children}</div>,
  TooltipTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    asChild ? <>{children}</> : <div data-testid="tooltip-trigger">{children}</div>
  ),
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div data-testid="select">{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => <option data-testid="select-item" value={value}>{children}</option>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="select-trigger">{children}</div>,
  SelectValue: () => <span data-testid="select-value">Select...</span>,
}));

jest.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange }: { checked?: boolean; onCheckedChange?: (checked: boolean) => void }) => (
    <input type="checkbox" data-testid="switch" checked={checked} onChange={(e) => onCheckedChange?.(e.target.checked)} />
  ),
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label data-testid="label">{children}</label>,
}));

jest.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => <div data-testid="collapsible">{children}</div>,
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => <div data-testid="collapsible-content">{children}</div>,
  CollapsibleTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    asChild ? <>{children}</> : <div data-testid="collapsible-trigger">{children}</div>
  ),
}));

jest.mock('@/components/ui/skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));

jest.mock('@/components/ui/empty-state', () => ({
  EmptyState: ({ message }: { message?: string }) => <div data-testid="empty-state">{message}</div>,
}));

import { AstroEventsCalendar } from '../astro-events-calendar';

describe('AstroEventsCalendar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<AstroEventsCalendar />);
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('renders dialog trigger button', () => {
    render(<AstroEventsCalendar />);
    const buttons = screen.getAllByTestId('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('renders dialog content', () => {
    render(<AstroEventsCalendar />);
    expect(screen.getByTestId('dialog-content')).toBeInTheDocument();
  });

  it('renders scroll area for events', () => {
    render(<AstroEventsCalendar />);
    expect(screen.getByTestId('scroll-area')).toBeInTheDocument();
  });

  it('renders data source switches from store', () => {
    render(<AstroEventsCalendar />);
    const switches = screen.getAllByTestId('switch');
    expect(switches.length).toBeGreaterThanOrEqual(2);
  });

  it('does not render event detail dialog by default', () => {
    render(<AstroEventsCalendar />);
    expect(screen.queryByTestId('event-detail-dialog')).not.toBeInTheDocument();
  });

  it('renders today button', () => {
    render(<AstroEventsCalendar />);
    expect(screen.getByText('events.today')).toBeInTheDocument();
  });

  it('renders event type filter select', () => {
    render(<AstroEventsCalendar />);
    expect(screen.getByText('events.allEvents')).toBeInTheDocument();
  });

  it('renders online status badge', () => {
    render(<AstroEventsCalendar />);
    expect(screen.getByText('events.online')).toBeInTheDocument();
  });

  it('renders timezone badge', () => {
    render(<AstroEventsCalendar />);
    expect(screen.getByText((t) => t.includes('events.timezone') && t.includes('Etc/UTC'))).toBeInTheDocument();
  });

  it('renders observer coordinates in footer', () => {
    render(<AstroEventsCalendar />);
    expect(screen.getByText('40.71°, -74.01°')).toBeInTheDocument();
  });

  it('renders no events message when empty', () => {
    render(<AstroEventsCalendar />);
    expect(screen.getByText('events.noEventsToday')).toBeInTheDocument();
  });

  it('renders event count in footer', () => {
    render(<AstroEventsCalendar />);
    expect(screen.getByText('0 events.eventsFound')).toBeInTheDocument();
  });

  it('renders month overview button', () => {
    render(<AstroEventsCalendar />);
    expect(screen.getByText('events.monthOverview')).toBeInTheDocument();
  });

  it('renders data sources settings section', () => {
    render(<AstroEventsCalendar />);
    expect(screen.getByText('events.dataSources')).toBeInTheDocument();
    expect(screen.getByText('USNO')).toBeInTheDocument();
    expect(screen.getByText('IMO')).toBeInTheDocument();
  });

  it('renders astronomical events title in dialog header', () => {
    render(<AstroEventsCalendar />);
    expect(screen.getByText('events.astronomicalEvents')).toBeInTheDocument();
  });

  it('renders filter options in select', () => {
    render(<AstroEventsCalendar />);
    expect(screen.getByText('events.lunarPhases')).toBeInTheDocument();
    expect(screen.getByText('events.meteorShowers')).toBeInTheDocument();
    expect(screen.getByText('events.conjunctions')).toBeInTheDocument();
    expect(screen.getByText('events.eclipses')).toBeInTheDocument();
  });

  it('renders navigation buttons for prev/next day', () => {
    render(<AstroEventsCalendar />);
    const buttons = screen.getAllByTestId('button');
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  });

  it('renders current date in header', () => {
    render(<AstroEventsCalendar />);
    const today = new Date();
    const dayStr = today.toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' });
    expect(screen.getByText(dayStr)).toBeInTheDocument();
  });
});
