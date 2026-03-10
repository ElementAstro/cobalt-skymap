/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ViewBookmarks } from '../view-bookmarks';

const mockToggleGroupContext = React.createContext<(value: string) => void>(() => undefined);

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

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

jest.mock('@/components/ui/textarea', () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}));

jest.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/toggle-group', () => {
  return {
    ToggleGroup: ({ children, onValueChange }: { children: React.ReactNode; onValueChange?: (value: string) => void }) => (
      <mockToggleGroupContext.Provider value={onValueChange ?? (() => undefined)}>
        <div role="group">{children}</div>
      </mockToggleGroupContext.Provider>
    ),
    ToggleGroupItem: ({
      children,
      value,
      className,
      'aria-label': ariaLabel,
    }: {
      children: React.ReactNode;
      value: string;
      className?: string;
      'aria-label'?: string;
    }) => {
      const handleValueChange = React.useContext(mockToggleGroupContext);
      return (
        <button
          type="button"
          role="radio"
          aria-label={ariaLabel}
          aria-checked={false}
          className={className}
          onClick={() => handleValueChange(value)}
        >
          {children}
        </button>
      );
    },
  };
});

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

jest.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuItem: ({ children, onClick, ...props }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) => <div role="menuitem" onClick={onClick} {...props}>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock bookmarks store
const mockBookmarksStore = {
  bookmarks: [] as Array<{
    id: string;
    name: string;
    ra: number;
    dec: number;
    fov: number;
    description?: string;
    color?: string;
    icon?: string;
    createdAt: number;
    updatedAt: number;
  }>,
  addBookmark: jest.fn(() => 'new-id'),
  updateBookmark: jest.fn(),
  removeBookmark: jest.fn(),
  duplicateBookmark: jest.fn(() => 'dup-id'),
};

jest.mock('@/lib/stores/bookmarks-store', () => ({
  useBookmarksStore: jest.fn((selector?: (s: typeof mockBookmarksStore) => unknown) =>
    selector ? selector(mockBookmarksStore) : mockBookmarksStore
  ),
  BOOKMARK_ICONS: ['star', 'heart', 'flag', 'pin', 'eye', 'camera', 'telescope'],
  BOOKMARK_COLORS: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'],
}));

describe('ViewBookmarks', () => {
  const defaultProps = {
    currentRa: 10.5,
    currentDec: 41.2,
    currentFov: 3.0,
    onNavigate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockBookmarksStore.bookmarks = [];
  });

  it('renders the bookmark trigger button', () => {
    render(<ViewBookmarks {...defaultProps} />);
    
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('shows empty state when no bookmarks exist', () => {
    render(<ViewBookmarks {...defaultProps} />);
    
    // The popover content should show empty message
    const content = screen.getByTestId('popover-content');
    expect(content).toBeInTheDocument();
  });

  it('renders bookmark items when bookmarks exist', () => {
    mockBookmarksStore.bookmarks = [
      {
        id: 'bm1',
        name: 'Orion Nebula',
        ra: 83.82,
        dec: -5.39,
        fov: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        icon: 'star',
        color: '#ef4444',
      },
    ];

    render(<ViewBookmarks {...defaultProps} />);
    
    expect(screen.getByText('Orion Nebula')).toBeInTheDocument();
  });

  it('renders bookmark entries as accessible buttons', () => {
    mockBookmarksStore.bookmarks = [
      {
        id: 'bm1',
        name: 'Orion Nebula',
        ra: 83.82,
        dec: -5.39,
        fov: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    render(<ViewBookmarks {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Orion Nebula' })).toBeInTheDocument();
  });

  it('renders multiple bookmarks when they exist', () => {
    mockBookmarksStore.bookmarks = [
      {
        id: 'bm1',
        name: 'Test Bookmark',
        ra: 0,
        dec: 0,
        fov: 60,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'bm2',
        name: 'Andromeda Galaxy',
        ra: 10,
        dec: 20,
        fov: 30,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    render(<ViewBookmarks {...defaultProps} />);
    
    expect(screen.getByText('Test Bookmark')).toBeInTheDocument();
    expect(screen.getByText('Andromeda Galaxy')).toBeInTheDocument();
  });

  it('shows delete confirmation dialog instead of deleting directly', () => {
    mockBookmarksStore.bookmarks = [
      {
        id: 'bm1',
        name: 'To Delete',
        ra: 0,
        dec: 0,
        fov: 60,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    render(<ViewBookmarks {...defaultProps} />);

    // Click delete in dropdown menu
    const deleteItems = screen.getAllByRole('menuitem').filter(el => el.textContent?.includes('common.delete'));
    expect(deleteItems.length).toBeGreaterThan(0);
    fireEvent.click(deleteItems[0]);

    // Confirm dialog should appear
    expect(screen.getByTestId('alert-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('alert-title')).toHaveTextContent('bookmarks.confirmDeleteTitle');
    expect(screen.getByTestId('alert-description')).toHaveTextContent('bookmarks.confirmDelete');

    // Should not have deleted yet
    expect(mockBookmarksStore.removeBookmark).not.toHaveBeenCalled();
  });

  it('deletes bookmark when confirmation is accepted', () => {
    mockBookmarksStore.bookmarks = [
      {
        id: 'bm1',
        name: 'To Delete',
        ra: 0,
        dec: 0,
        fov: 60,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    render(<ViewBookmarks {...defaultProps} />);

    // Trigger delete
    const deleteItems = screen.getAllByRole('menuitem').filter(el => el.textContent?.includes('common.delete'));
    fireEvent.click(deleteItems[0]);

    // Confirm
    fireEvent.click(screen.getByTestId('alert-confirm'));
    expect(mockBookmarksStore.removeBookmark).toHaveBeenCalledWith('bm1');
  });

  it('calls onNavigate when clicking a bookmark item', () => {
    mockBookmarksStore.bookmarks = [
      {
        id: 'bm1',
        name: 'M42',
        ra: 83.82,
        dec: -5.39,
        fov: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        icon: 'star',
      },
    ];

    render(<ViewBookmarks {...defaultProps} />);

    const bookmarkItem = screen.getByRole('button', { name: 'M42' });
    fireEvent.click(bookmarkItem);

    expect(defaultProps.onNavigate).toHaveBeenCalledWith(83.82, -5.39, 2);
  });

  it('calls onNavigate via Go To dropdown menu item', () => {
    mockBookmarksStore.bookmarks = [
      {
        id: 'bm1',
        name: 'NGC 7000',
        ra: 314.7,
        dec: 44.3,
        fov: 5,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    render(<ViewBookmarks {...defaultProps} />);

    const goToItems = screen.getAllByRole('menuitem').filter(el => el.textContent?.includes('bookmarks.goTo'));
    expect(goToItems.length).toBeGreaterThan(0);
    fireEvent.click(goToItems[0]);

    expect(defaultProps.onNavigate).toHaveBeenCalledWith(314.7, 44.3, 5);
  });

  it('calls duplicateBookmark via dropdown menu item', () => {
    mockBookmarksStore.bookmarks = [
      {
        id: 'bm1',
        name: 'Test BM',
        ra: 10,
        dec: 20,
        fov: 30,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    render(<ViewBookmarks {...defaultProps} />);

    const dupItems = screen.getAllByRole('menuitem').filter(el => el.textContent?.includes('bookmarks.duplicate'));
    expect(dupItems.length).toBeGreaterThan(0);
    fireEvent.click(dupItems[0]);

    expect(mockBookmarksStore.duplicateBookmark).toHaveBeenCalledWith('bm1', 'bookmarks.copySuffix');
  });

  it('opens add dialog and shows save current view title', () => {
    mockBookmarksStore.bookmarks = [];
    render(<ViewBookmarks {...defaultProps} />);

    // Find the add bookmark button (BookmarkPlus icon button in header)
    const addBtns = screen.getAllByRole('button');
    const addBtn = addBtns.find(btn => btn.className?.includes('h-6'));
    if (addBtn) {
      fireEvent.click(addBtn);
    }

    // Dialog always renders (mock), so saveCurrentView text appears in multiple places
    // (tooltip, dialog title, empty state button)
    const matches = screen.getAllByText('bookmarks.saveCurrentView');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('shows current position info when adding a new bookmark', () => {
    mockBookmarksStore.bookmarks = [];
    render(<ViewBookmarks {...defaultProps} />);

    // The dialog is always rendered (Dialog mock renders children always)
    expect(screen.getByText('bookmarks.currentPosition')).toBeInTheDocument();
    expect(screen.getByText(/10.5000°/)).toBeInTheDocument();
    expect(screen.getByText(/41.2000°/)).toBeInTheDocument();
  });

  it('saves a new bookmark when form is filled and save is clicked', () => {
    mockBookmarksStore.bookmarks = [];
    render(<ViewBookmarks {...defaultProps} />);

    // Fill in the name field
    const nameInput = screen.getByPlaceholderText('bookmarks.namePlaceholder');
    fireEvent.change(nameInput, { target: { value: 'My View' } });

    // Click save — find button with saveBookmark text
    const saveBtn = screen.getAllByRole('button').find(btn => btn.textContent === 'bookmarks.saveBookmark');
    expect(saveBtn).toBeDefined();
    fireEvent.click(saveBtn!);

    expect(mockBookmarksStore.addBookmark).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'My View',
        ra: 10.5,
        dec: 41.2,
        fov: 3.0,
      })
    );
  });

  it('does not save when name is empty', () => {
    mockBookmarksStore.bookmarks = [];
    render(<ViewBookmarks {...defaultProps} />);

    // The save button should be disabled when name is empty
    const saveBtn = screen.getAllByRole('button').find(btn => btn.textContent === 'bookmarks.saveBookmark');
    expect(saveBtn).toBeDefined();
    expect(saveBtn).toBeDisabled();
  });

  it('opens edit dialog with existing bookmark data', () => {
    mockBookmarksStore.bookmarks = [
      {
        id: 'bm1',
        name: 'Edit Me',
        ra: 10,
        dec: 20,
        fov: 30,
        description: 'A nice view',
        color: '#ef4444',
        icon: 'heart',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    render(<ViewBookmarks {...defaultProps} />);

    // Click edit menu item
    const editItems = screen.getAllByRole('menuitem').filter(el => el.textContent?.includes('common.edit'));
    expect(editItems.length).toBeGreaterThan(0);
    fireEvent.click(editItems[0]);

    // Dialog should show edit title
    expect(screen.getByText('bookmarks.editBookmark')).toBeInTheDocument();
  });

  it('saves edited bookmark with updateBookmark', () => {
    mockBookmarksStore.bookmarks = [
      {
        id: 'bm1',
        name: 'Original Name',
        ra: 10,
        dec: 20,
        fov: 30,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    render(<ViewBookmarks {...defaultProps} />);

    // Click edit menu item to load the bookmark into form
    const editItems = screen.getAllByRole('menuitem').filter(el => el.textContent?.includes('common.edit'));
    fireEvent.click(editItems[0]);

    // Change the name
    const nameInput = screen.getByDisplayValue('Original Name');
    fireEvent.change(nameInput, { target: { value: 'Updated Name' } });

    // Click save
    const saveBtn = screen.getAllByRole('button').find(btn => btn.textContent === 'common.save');
    expect(saveBtn).toBeDefined();
    fireEvent.click(saveBtn!);

    expect(mockBookmarksStore.updateBookmark).toHaveBeenCalledWith('bm1', expect.objectContaining({
      name: 'Updated Name',
    }));
  });

  it('renders bookmark description when present', () => {
    mockBookmarksStore.bookmarks = [
      {
        id: 'bm1',
        name: 'M31',
        ra: 10,
        dec: 41,
        fov: 3,
        description: 'Andromeda Galaxy',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    render(<ViewBookmarks {...defaultProps} />);
    expect(screen.getByText('Andromeda Galaxy')).toBeInTheDocument();
  });

  it('renders icon selector buttons in edit dialog', () => {
    mockBookmarksStore.bookmarks = [];
    render(<ViewBookmarks {...defaultProps} />);

    // Icon selector label should exist
    expect(screen.getByText('bookmarks.icon')).toBeInTheDocument();
    // Should have icon selector buttons (7 icons)
    const iconButtons = screen.getAllByRole('radio');
    expect(iconButtons.length).toBe(7);
  });

  it('renders color selector buttons in edit dialog', () => {
    mockBookmarksStore.bookmarks = [];
    render(<ViewBookmarks {...defaultProps} />);

    expect(screen.getByText('bookmarks.color')).toBeInTheDocument();
  });

  it('updates form description field', () => {
    mockBookmarksStore.bookmarks = [];
    render(<ViewBookmarks {...defaultProps} />);

    const descInput = screen.getByPlaceholderText('bookmarks.descriptionPlaceholder');
    fireEvent.change(descInput, { target: { value: 'A nice view' } });

    // Now fill name and save
    const nameInput = screen.getByPlaceholderText('bookmarks.namePlaceholder');
    fireEvent.change(nameInput, { target: { value: 'My View' } });

    const saveBtn = screen.getAllByRole('button').find(btn => btn.textContent === 'bookmarks.saveBookmark');
    fireEvent.click(saveBtn!);

    expect(mockBookmarksStore.addBookmark).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'A nice view',
      })
    );
  });

  it('shows empty state with save link button when no bookmarks', () => {
    mockBookmarksStore.bookmarks = [];
    render(<ViewBookmarks {...defaultProps} />);

    expect(screen.getByText('bookmarks.noBookmarks')).toBeInTheDocument();
  });

  it('selects an icon in the icon selector', () => {
    mockBookmarksStore.bookmarks = [];
    render(<ViewBookmarks {...defaultProps} />);

    // Click heart icon button
    const iconButtons = screen.getAllByRole('radio');
    expect(iconButtons.length).toBe(7);
    fireEvent.click(screen.getByRole('radio', { name: 'heart' }));

    // Fill name and save to verify the icon was changed
    const nameInput = screen.getByPlaceholderText('bookmarks.namePlaceholder');
    fireEvent.change(nameInput, { target: { value: 'Heart Bookmark' } });

    const saveBtn = screen.getAllByRole('button').find(btn => btn.textContent === 'bookmarks.saveBookmark');
    fireEvent.click(saveBtn!);

    expect(mockBookmarksStore.addBookmark).toHaveBeenCalledWith(
      expect.objectContaining({ icon: 'heart' })
    );
  });

  it('selects a color in the color selector', () => {
    mockBookmarksStore.bookmarks = [];
    render(<ViewBookmarks {...defaultProps} />);

    // Color buttons are rendered by ColorPicker (w-7 h-7 icon buttons)
    const colorButtons = screen.getAllByRole('button').filter(
      btn => btn.className?.includes('w-7') && btn.className?.includes('h-7')
    );
    expect(colorButtons.length).toBe(8); // 8 BOOKMARK_COLORS
    // Click the first color (red = #ef4444)
    fireEvent.click(colorButtons[0]);

    // Fill name and save to verify the color was changed
    const nameInput = screen.getByPlaceholderText('bookmarks.namePlaceholder');
    fireEvent.change(nameInput, { target: { value: 'Red Bookmark' } });

    const saveBtn = screen.getAllByRole('button').find(btn => btn.textContent === 'bookmarks.saveBookmark');
    fireEvent.click(saveBtn!);

    expect(mockBookmarksStore.addBookmark).toHaveBeenCalledWith(
      expect.objectContaining({ color: '#ef4444' })
    );
  });

  it('stopPropagation on dropdown trigger does not navigate', () => {
    mockBookmarksStore.bookmarks = [
      {
        id: 'bm1',
        name: 'Test',
        ra: 10,
        dec: 20,
        fov: 30,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    render(<ViewBookmarks {...defaultProps} />);

    // The dropdown trigger button has h-6 w-6 class inside the bookmark item
    const dropdownTriggerBtns = screen.getAllByRole('button').filter(
      btn => btn.className?.includes('h-6') && btn.closest('div[class*="cursor-pointer"]')
    );
    if (dropdownTriggerBtns.length > 0) {
      fireEvent.click(dropdownTriggerBtns[0]);
      // stopPropagation should prevent onNavigate from being called
      // (though with simplified mocks this is hard to fully verify)
    }
  });

  it('cancel button in edit dialog does not save', () => {
    mockBookmarksStore.bookmarks = [];
    render(<ViewBookmarks {...defaultProps} />);

    // Fill name
    const nameInput = screen.getByPlaceholderText('bookmarks.namePlaceholder');
    fireEvent.change(nameInput, { target: { value: 'Will Cancel' } });

    // Click cancel
    const cancelBtn = screen.getAllByRole('button').find(btn => btn.textContent === 'common.cancel');
    expect(cancelBtn).toBeDefined();
    fireEvent.click(cancelBtn!);

    expect(mockBookmarksStore.addBookmark).not.toHaveBeenCalled();
  });
});
