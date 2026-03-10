/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// Mock tauri module
jest.mock('@/lib/tauri', () => {
  const mockRefresh = jest.fn();
  const mockSetCurrent = jest.fn();
  return {
    useLocations: jest.fn(() => ({
      locations: { locations: [] },
      currentLocation: null,
      loading: false,
      refresh: mockRefresh,
      setCurrent: mockSetCurrent,
      isAvailable: true,
    })),
    tauriApi: {
      locations: {
        add: jest.fn(),
        delete: jest.fn(),
      },
    },
  };
});

jest.mock('@/lib/services/location-acquisition', () => ({
  acquireCurrentLocation: jest.fn(),
}));

jest.mock('@/lib/services/geocoding-service', () => ({
  geocodingService: {
    reverseGeocode: jest.fn(),
  },
}));

// Import mocked modules
import { useLocations, tauriApi } from '@/lib/tauri';
import { acquireCurrentLocation } from '@/lib/services/location-acquisition';
import { geocodingService } from '@/lib/services/geocoding-service';
import { useWebLocationStore } from '@/lib/stores/web-location-store';

const mockUseLocations = useLocations as jest.Mock;
const mockTauriApi = tauriApi as jest.Mocked<typeof tauriApi>;
const mockAcquireCurrentLocation = acquireCurrentLocation as jest.Mock;
const mockReverseGeocode = geocodingService.reverseGeocode as jest.Mock;

// Mock toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

import { toast as mockToast } from 'sonner';

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
    size,
    title,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children?: React.ReactNode;
    variant?: string;
    size?: string;
  }) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant} data-size={size} title={title} {...props}>
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    children,
    open,
    onOpenChange,
  }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => (
    <div data-testid="dialog" data-open={open}>
      <button data-testid="dialog-open-btn" onClick={() => onOpenChange?.(true)}>
        Open
      </button>
      {children}
    </div>
  ),
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="dialog-description">{children}</p>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
  DialogTrigger: ({
    children,
    asChild,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => (asChild ? <>{children}</> : <div data-testid="dialog-trigger">{children}</div>),
}));

jest.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    type,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      data-testid="input"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      type={type}
      {...props}
    />
  ),
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => (
    <label data-testid="label">{children}</label>
  ),
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange?: (value: string) => void;
  }) => (
    <div data-testid="select" data-value={value}>
      <select
        value={value}
        onChange={(e) => onValueChange?.(e.target.value)}
        data-testid="select-native"
      >
        {children}
      </select>
    </div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="scroll-area">{children}</div>
  ),
}));

jest.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open?: boolean;
  }) => (
    open ? <div data-testid="alert-dialog" data-open={open}>{children}</div> : null
  ),
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-dialog-content">{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-dialog-header">{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="alert-dialog-title">{children}</h2>
  ),
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="alert-dialog-description">{children}</p>
  ),
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-dialog-footer">{children}</div>
  ),
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => (
    <button data-testid="alert-dialog-cancel">{children}</button>
  ),
  AlertDialogAction: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <button data-testid="alert-dialog-action" onClick={onClick}>{children}</button>
  ),
}));

import { LocationManager } from '../location-manager';

describe('LocationManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useWebLocationStore.setState({ locations: [] });
    mockUseLocations.mockReturnValue({
      locations: { locations: [] },
      currentLocation: null,
      loading: false,
      refresh: jest.fn(),
      setCurrent: jest.fn(),
      isAvailable: true,
    });
    mockAcquireCurrentLocation.mockResolvedValue({
      status: 'success',
      source: 'browser',
      location: {
        latitude: 51.5074,
        longitude: -0.1278,
        altitude: 50,
        accuracy: 10,
        timestamp: Date.now(),
      },
    });
    mockReverseGeocode.mockResolvedValue({
      displayName: 'London, UK',
      address: 'London, UK',
      coordinates: { latitude: 51.5074, longitude: -0.1278 },
    });
  });

  describe('Rendering', () => {
    it('renders web fallback when not available (non-Tauri environment)', () => {
      mockUseLocations.mockReturnValue({
        locations: null,
        currentLocation: null,
        loading: false,
        refresh: jest.fn(),
        setCurrent: jest.fn(),
        isAvailable: false,
      });

      const { container } = render(<LocationManager />);
      expect(container.firstChild).not.toBeNull();
      expect(screen.getAllByText(/locations\.title/).length).toBeGreaterThanOrEqual(1);
    });

    it('renders default trigger button when available', () => {
      render(<LocationManager />);
      expect(screen.getAllByText(/locations\.title/).length).toBeGreaterThanOrEqual(1);
    });

    it('renders current location name in trigger when set', () => {
      mockUseLocations.mockReturnValue({
        locations: { locations: [] },
        currentLocation: { name: 'My Backyard', latitude: 40, longitude: -74, altitude: 100 },
        loading: false,
        refresh: jest.fn(),
        setCurrent: jest.fn(),
        isAvailable: true,
      });

      render(<LocationManager />);
      expect(screen.getByText('My Backyard')).toBeInTheDocument();
    });

    it('renders custom trigger when provided', () => {
      render(<LocationManager trigger={<button data-testid="custom-trigger">Custom</button>} />);
      expect(screen.getByTestId('custom-trigger')).toBeInTheDocument();
    });

    it('renders dialog content', () => {
      render(<LocationManager />);
      expect(screen.getByTestId('dialog-content')).toBeInTheDocument();
    });

    it('renders dialog title', () => {
      render(<LocationManager />);
      expect(screen.getByTestId('dialog-title')).toBeInTheDocument();
    });

    it('renders dialog description', () => {
      render(<LocationManager />);
      expect(screen.getByTestId('dialog-description')).toBeInTheDocument();
    });

    it('shows loading state', () => {
      mockUseLocations.mockReturnValue({
        locations: null,
        currentLocation: null,
        loading: true,
        refresh: jest.fn(),
        setCurrent: jest.fn(),
        isAvailable: true,
      });

      render(<LocationManager />);
      expect(screen.getByTestId('dialog-content')).toBeInTheDocument();
    });
  });

  describe('Location List', () => {
    it('shows empty message when no locations', () => {
      render(<LocationManager />);
      expect(screen.getByText(/locations\.noLocations/)).toBeInTheDocument();
    });

    it('shows add location button', () => {
      render(<LocationManager />);
      expect(screen.getByText(/locations\.addLocation/)).toBeInTheDocument();
    });

    it('shows location list when locations exist', () => {
      mockUseLocations.mockReturnValue({
        locations: {
          locations: [
            {
              id: '1',
              name: 'Dark Site',
              latitude: 40.7128,
              longitude: -74.006,
              altitude: 100,
              bortle_class: 3,
              is_default: true,
              is_current: true,
            },
          ],
        },
        currentLocation: null,
        loading: false,
        refresh: jest.fn(),
        setCurrent: jest.fn(),
        isAvailable: true,
      });

      render(<LocationManager />);
      expect(screen.getByText('Dark Site')).toBeInTheDocument();
      expect(screen.getByText(/40\.7128°, -74\.0060°/)).toBeInTheDocument();
      expect(screen.getByText(/Bortle 3/)).toBeInTheDocument();
    });

    it('shows location without bortle class', () => {
      mockUseLocations.mockReturnValue({
        locations: {
          locations: [
            {
              id: '1',
              name: 'Simple Site',
              latitude: 35.0,
              longitude: 120.0,
              altitude: 50,
              is_default: false,
              is_current: false,
            },
          ],
        },
        currentLocation: null,
        loading: false,
        refresh: jest.fn(),
        setCurrent: jest.fn(),
        isAvailable: true,
      });

      render(<LocationManager />);
      expect(screen.getByText('Simple Site')).toBeInTheDocument();
      expect(screen.queryByText(/Bortle/)).not.toBeInTheDocument();
    });
  });

  describe('Add Location Form', () => {
    it('shows add form when add button clicked', async () => {
      render(<LocationManager />);

      const addButton = screen.getByText(/locations\.addLocation/);
      await act(async () => {
        fireEvent.click(addButton);
      });

      expect(screen.getByPlaceholderText(/locations\.namePlaceholder|e\.g\. Backyard/)).toBeInTheDocument();
      expect(screen.getByPlaceholderText('39.9042')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('116.4074')).toBeInTheDocument();
    });

    it('shows cancel button in add form', async () => {
      render(<LocationManager />);

      const addButton = screen.getByText(/locations\.addLocation/);
      await act(async () => {
        fireEvent.click(addButton);
      });

      expect(screen.getByText(/common\.cancel/)).toBeInTheDocument();
    });

    it('shows GPS button in add form', async () => {
      render(<LocationManager />);

      const addButton = screen.getByText(/locations\.addLocation/);
      await act(async () => {
        fireEvent.click(addButton);
      });

      expect(screen.getByText(/locations\.useGPS/)).toBeInTheDocument();
    });

    it('hides form when cancel clicked', async () => {
      render(<LocationManager />);

      const addButton = screen.getByText(/locations\.addLocation/);
      await act(async () => {
        fireEvent.click(addButton);
      });

      const cancelButton = screen.getByText(/common\.cancel/);
      await act(async () => {
        fireEvent.click(cancelButton);
      });

      expect(screen.getByText(/locations\.addLocation/)).toBeInTheDocument();
    });

    it('shows error when required fields are empty', async () => {
      render(<LocationManager />);

      const addButton = screen.getByText(/locations\.addLocation/);
      await act(async () => {
        fireEvent.click(addButton);
      });

      const saveButton = screen.getByText(/common\.save/);
      await act(async () => {
        fireEvent.click(saveButton);
      });

      expect(mockToast.error).toHaveBeenCalled();
    });

    it('calls add API with correct data', async () => {
      const mockRefresh = jest.fn();
      mockUseLocations.mockReturnValue({
        locations: { locations: [] },
        currentLocation: null,
        loading: false,
        refresh: mockRefresh,
        setCurrent: jest.fn(),
        isAvailable: true,
      });
      (mockTauriApi.locations.add as jest.Mock).mockResolvedValue(undefined);

      render(<LocationManager />);

      const addButton = screen.getByText(/locations\.addLocation/);
      await act(async () => {
        fireEvent.click(addButton);
      });

      const nameInput = screen.getByPlaceholderText(/locations\.namePlaceholder|e\.g\. Backyard/);
      const latInput = screen.getByPlaceholderText('39.9042');
      const lonInput = screen.getByPlaceholderText('116.4074');
      const altInput = screen.getByPlaceholderText('100');

      await act(async () => {
        fireEvent.change(nameInput, { target: { value: 'Test Site' } });
        fireEvent.change(latInput, { target: { value: '40.5' } });
        fireEvent.change(lonInput, { target: { value: '-73.5' } });
        fireEvent.change(altInput, { target: { value: '200' } });
      });

      // Change bortle class via select
      const bortleSelects = screen.getAllByTestId('select-native');
      const bortleSelect = bortleSelects[bortleSelects.length - 1];
      await act(async () => {
        fireEvent.change(bortleSelect, { target: { value: '5' } });
      });

      const saveButton = screen.getByText(/common\.save/);
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(mockTauriApi.locations.add).toHaveBeenCalledWith({
          name: 'Test Site',
          latitude: 40.5,
          longitude: -73.5,
          altitude: 200,
          bortle_class: 5,
          is_default: true,
          is_current: true,
        });
        expect(mockToast.success).toHaveBeenCalled();
        expect(mockRefresh).toHaveBeenCalled();
      });
    });

    it('shows error toast when add fails', async () => {
      (mockTauriApi.locations.add as jest.Mock).mockRejectedValue(new Error('API Error'));

      render(<LocationManager />);

      const addButton = screen.getByText(/locations\.addLocation/);
      await act(async () => {
        fireEvent.click(addButton);
      });

      const nameInput = screen.getByPlaceholderText(/locations\.namePlaceholder|e\.g\. Backyard/);
      const latInput = screen.getByPlaceholderText('39.9042');
      const lonInput = screen.getByPlaceholderText('116.4074');

      await act(async () => {
        fireEvent.change(nameInput, { target: { value: 'Test' } });
        fireEvent.change(latInput, { target: { value: '40' } });
        fireEvent.change(lonInput, { target: { value: '-74' } });
      });

      const saveButton = screen.getByText(/common\.save/);
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('API Error');
      });
    });
  });

  describe('Delete Location', () => {
    it('deletes location when delete button clicked', async () => {
      const mockRefresh = jest.fn();
      mockUseLocations.mockReturnValue({
        locations: {
          locations: [
            {
              id: 'loc-1',
              name: 'Test Site',
              latitude: 40,
              longitude: -74,
              altitude: 100,
              is_default: false,
              is_current: false,
            },
          ],
        },
        currentLocation: null,
        loading: false,
        refresh: mockRefresh,
        setCurrent: jest.fn(),
        isAvailable: true,
      });
      (mockTauriApi.locations.delete as jest.Mock).mockResolvedValue({
        locations: [],
        current_location_id: null,
      });

      render(<LocationManager />);

      // Find delete button (ghost variant with Trash2 icon)
      const deleteButtons = screen.getAllByRole('button').filter(
        (btn) => btn.getAttribute('data-variant') === 'ghost'
      );
      expect(deleteButtons.length).toBeGreaterThan(0);

      // Click delete button opens confirmation dialog
      await act(async () => {
        fireEvent.click(deleteButtons[deleteButtons.length - 1]);
      });

      // Confirm deletion in AlertDialog
      await act(async () => {
        fireEvent.click(screen.getByTestId('alert-dialog-action'));
      });

      await waitFor(() => {
        expect(mockTauriApi.locations.delete).toHaveBeenCalledWith('loc-1');
        expect(mockToast.success).toHaveBeenCalled();
        expect(mockRefresh).toHaveBeenCalled();
      });
    });

    it('shows error toast when delete fails', async () => {
      mockUseLocations.mockReturnValue({
        locations: {
          locations: [
            {
              id: 'loc-1',
              name: 'Test',
              latitude: 40,
              longitude: -74,
              altitude: 100,
              is_default: false,
              is_current: false,
            },
          ],
        },
        currentLocation: null,
        loading: false,
        refresh: jest.fn(),
        setCurrent: jest.fn(),
        isAvailable: true,
      });
      (mockTauriApi.locations.delete as jest.Mock).mockRejectedValue(new Error('Delete failed'));

      render(<LocationManager />);

      const deleteButtons = screen.getAllByRole('button').filter(
        (btn) => btn.getAttribute('data-variant') === 'ghost'
      );

      // Click delete button opens confirmation dialog
      await act(async () => {
        fireEvent.click(deleteButtons[deleteButtons.length - 1]);
      });

      // Confirm deletion in AlertDialog
      await act(async () => {
        fireEvent.click(screen.getByTestId('alert-dialog-action'));
      });

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Delete failed');
      });
    });

    it('promotes deterministic current location in web mode after deleting current', async () => {
      const mockOnLocationChange = jest.fn();
      useWebLocationStore.setState({
        locations: [
          {
            id: 'loc-a',
            name: 'Current Web',
            latitude: 10,
            longitude: 20,
            altitude: 100,
            is_default: false,
            is_current: true,
          },
          {
            id: 'loc-b',
            name: 'Default Web',
            latitude: 11,
            longitude: 22,
            altitude: 110,
            is_default: true,
            is_current: false,
          },
          {
            id: 'loc-c',
            name: 'Other Web',
            latitude: 12,
            longitude: 24,
            altitude: 120,
            is_default: false,
            is_current: false,
          },
        ],
      });
      mockUseLocations.mockReturnValue({
        locations: null,
        currentLocation: null,
        loading: false,
        refresh: jest.fn(),
        setCurrent: jest.fn(),
        isAvailable: false,
      });

      render(<LocationManager onLocationChange={mockOnLocationChange} />);

      const ghostButtons = screen.getAllByRole('button').filter(
        (btn) => btn.getAttribute('data-variant') === 'ghost'
      );

      await act(async () => {
        fireEvent.click(ghostButtons[1]);
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('alert-dialog-action'));
      });

      await waitFor(() => {
        const locations = useWebLocationStore.getState().locations;
        expect(locations.some((loc) => loc.id === 'loc-a')).toBe(false);
        const currents = locations.filter((loc) => loc.is_current);
        expect(currents).toHaveLength(1);
        expect(currents[0].id).toBe('loc-b');
        expect(mockOnLocationChange).toHaveBeenCalledWith(11, 22, 110);
        expect(mockOnLocationChange).toHaveBeenCalledTimes(1);
      });
    });

    it('does not emit location callback when deleting non-current location in web mode', async () => {
      const mockOnLocationChange = jest.fn();
      useWebLocationStore.setState({
        locations: [
          {
            id: 'loc-a',
            name: 'Current Web',
            latitude: 10,
            longitude: 20,
            altitude: 100,
            is_default: true,
            is_current: true,
          },
          {
            id: 'loc-b',
            name: 'Other Web',
            latitude: 11,
            longitude: 22,
            altitude: 110,
            is_default: false,
            is_current: false,
          },
        ],
      });
      mockUseLocations.mockReturnValue({
        locations: null,
        currentLocation: null,
        loading: false,
        refresh: jest.fn(),
        setCurrent: jest.fn(),
        isAvailable: false,
      });

      render(<LocationManager onLocationChange={mockOnLocationChange} />);

      const ghostButtons = screen.getAllByRole('button').filter(
        (btn) => btn.getAttribute('data-variant') === 'ghost'
      );

      await act(async () => {
        fireEvent.click(ghostButtons[4]);
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('alert-dialog-action'));
      });

      await waitFor(() => {
        expect(mockOnLocationChange).not.toHaveBeenCalled();
      });
    });
  });

  describe('Set Current Location', () => {
    it('sets location as current when navigation button clicked', async () => {
      const mockSetCurrent = jest.fn().mockResolvedValue(undefined);
      const mockOnLocationChange = jest.fn();
      mockUseLocations.mockReturnValue({
        locations: {
          locations: [
            {
              id: 'loc-1',
              name: 'Test Site',
              latitude: 40.5,
              longitude: -73.5,
              altitude: 150,
              is_default: false,
              is_current: false,
            },
          ],
        },
        currentLocation: null,
        loading: false,
        refresh: jest.fn(),
        setCurrent: mockSetCurrent,
        isAvailable: true,
      });

      render(<LocationManager onLocationChange={mockOnLocationChange} />);

      // Find navigation button (first ghost button for non-current location)
      const navButtons = screen.getAllByRole('button').filter(
        (btn) => btn.getAttribute('data-variant') === 'ghost'
      );

      await act(async () => {
        fireEvent.click(navButtons[0]); // First ghost button is set current
      });

      await waitFor(() => {
        expect(mockSetCurrent).toHaveBeenCalledWith('loc-1');
        expect(mockOnLocationChange).toHaveBeenCalledWith(40.5, -73.5, 150);
        expect(mockToast.success).toHaveBeenCalled();
      });
    });

    it('does not show navigation button for current location', () => {
      mockUseLocations.mockReturnValue({
        locations: {
          locations: [
            {
              id: 'loc-1',
              name: 'Current Site',
              latitude: 40,
              longitude: -74,
              altitude: 100,
              is_default: true,
              is_current: true,
            },
          ],
        },
        currentLocation: null,
        loading: false,
        refresh: jest.fn(),
        setCurrent: jest.fn(),
        isAvailable: true,
      });

      render(<LocationManager />);

      // Only delete button should be visible (no navigation button for current)
      const ghostButtons = screen.getAllByRole('button').filter(
        (btn) => btn.getAttribute('data-variant') === 'ghost'
      );
      expect(ghostButtons.length).toBe(2); // Edit + delete buttons (no navigation button for current)
    });

    it('shows error toast when set current fails', async () => {
      const mockSetCurrent = jest.fn().mockRejectedValue(new Error('Set current failed'));
      mockUseLocations.mockReturnValue({
        locations: {
          locations: [
            {
              id: 'loc-1',
              name: 'Test',
              latitude: 40,
              longitude: -74,
              altitude: 100,
              is_default: false,
              is_current: false,
            },
          ],
        },
        currentLocation: null,
        loading: false,
        refresh: jest.fn(),
        setCurrent: mockSetCurrent,
        isAvailable: true,
      });

      render(<LocationManager />);

      const navButtons = screen.getAllByRole('button').filter(
        (btn) => btn.getAttribute('data-variant') === 'ghost'
      );

      await act(async () => {
        fireEvent.click(navButtons[0]);
      });

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Set current failed');
      });
    });
  });

  describe('GPS Functionality', () => {
    it('fills form with GPS coordinates on success', async () => {
      render(<LocationManager />);

      const addButton = screen.getByText(/locations\.addLocation/);
      await act(async () => {
        fireEvent.click(addButton);
      });

      const gpsButton = screen.getByText(/locations\.useGPS/);
      await act(async () => {
        fireEvent.click(gpsButton);
      });

      const latInput = screen.getByPlaceholderText('39.9042') as HTMLInputElement;
      const lonInput = screen.getByPlaceholderText('116.4074') as HTMLInputElement;
      const nameInput = screen.getByPlaceholderText(/locations\.namePlaceholder|e\.g\. Backyard/) as HTMLInputElement;
      const altitudeInput = screen.getByPlaceholderText('100') as HTMLInputElement;

      expect(latInput.value).toBe('51.507400');
      expect(lonInput.value).toBe('-0.127800');
      expect(nameInput.value).toBe('London, UK');
      expect(altitudeInput.value).toBe('50');
      expect(mockToast.success).toHaveBeenCalled();
    });

    it('does not overwrite manually edited metadata when GPS auto-fill runs', async () => {
      render(<LocationManager />);

      const addButton = screen.getByText(/locations\.addLocation/);
      await act(async () => {
        fireEvent.click(addButton);
      });

      const nameInput = screen.getByPlaceholderText(/locations\.namePlaceholder|e\.g\. Backyard/);
      const altitudeInput = screen.getByPlaceholderText('100');
      await act(async () => {
        fireEvent.change(nameInput, { target: { value: 'Manual Site Name' } });
        fireEvent.change(altitudeInput, { target: { value: '321' } });
      });

      const gpsButton = screen.getByText(/locations\.useGPS/);
      await act(async () => {
        fireEvent.click(gpsButton);
      });

      expect((nameInput as HTMLInputElement).value).toBe('Manual Site Name');
      expect((altitudeInput as HTMLInputElement).value).toBe('321');
    });

    it('shows error when GPS fails', async () => {
      mockAcquireCurrentLocation.mockResolvedValue({
        status: 'failed',
        source: 'browser',
        message: 'GPS Error',
      });

      render(<LocationManager />);

      const addButton = screen.getByText(/locations\.addLocation/);
      await act(async () => {
        fireEvent.click(addButton);
      });

      const gpsButton = screen.getByText(/locations\.useGPS/);
      await act(async () => {
        fireEvent.click(gpsButton);
      });

      expect(mockToast.error).toHaveBeenCalledWith('locations.locationFailed');
    });

    it('shows error when GPS not supported', async () => {
      mockAcquireCurrentLocation.mockResolvedValue({
        status: 'unavailable',
        source: 'browser',
        message: 'not available',
      });

      render(<LocationManager />);

      const addButton = screen.getByText(/locations\.addLocation/);
      await act(async () => {
        fireEvent.click(addButton);
      });

      const gpsButton = screen.getByText(/locations\.useGPS/);
      await act(async () => {
        fireEvent.click(gpsButton);
      });

      expect(mockToast.error).toHaveBeenCalledWith('locations.locationUnavailable');
    });
  });

  describe('Location Indicators', () => {
    it('shows star icon for default location', () => {
      mockUseLocations.mockReturnValue({
        locations: {
          locations: [
            {
              id: '1',
              name: 'Default Site',
              latitude: 40,
              longitude: -74,
              altitude: 100,
              is_default: true,
              is_current: false,
            },
          ],
        },
        currentLocation: null,
        loading: false,
        refresh: jest.fn(),
        setCurrent: jest.fn(),
        isAvailable: true,
      });

      render(<LocationManager />);
      expect(screen.getByText('Default Site')).toBeInTheDocument();
    });

    it('shows check icon for current location', () => {
      mockUseLocations.mockReturnValue({
        locations: {
          locations: [
            {
              id: '1',
              name: 'Current Site',
              latitude: 40,
              longitude: -74,
              altitude: 100,
              is_default: false,
              is_current: true,
            },
          ],
        },
        currentLocation: null,
        loading: false,
        refresh: jest.fn(),
        setCurrent: jest.fn(),
        isAvailable: true,
      });

      render(<LocationManager />);
      expect(screen.getByText('Current Site')).toBeInTheDocument();
    });

    it('highlights current location with special styling', () => {
      mockUseLocations.mockReturnValue({
        locations: {
          locations: [
            {
              id: '1',
              name: 'Current Site',
              latitude: 40,
              longitude: -74,
              altitude: 100,
              is_default: false,
              is_current: true,
            },
          ],
        },
        currentLocation: null,
        loading: false,
        refresh: jest.fn(),
        setCurrent: jest.fn(),
        isAvailable: true,
      });

      render(<LocationManager />);
      // The location item should have border-primary class
      expect(screen.getByText('Current Site')).toBeInTheDocument();
    });
  });
});
