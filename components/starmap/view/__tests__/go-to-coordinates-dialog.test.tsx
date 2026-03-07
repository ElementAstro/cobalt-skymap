/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: React.PropsWithChildren<{ open: boolean }>) => open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DialogHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DialogTitle: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DialogDescription: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DialogFooter: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));
jest.mock('@/components/ui/button', () => ({ Button: ({ children, onClick, ...props }: React.PropsWithChildren<{ onClick?: () => void }>) => <button onClick={onClick} {...props}>{children}</button> }));
jest.mock('@/components/ui/input', () => ({ Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} /> }));
jest.mock('@/components/ui/label', () => ({ Label: ({ children }: React.PropsWithChildren) => <label>{children}</label> }));

jest.mock('@/lib/astronomy/coordinates/conversions', () => ({
  parseRACoordinate: jest.fn((v: string) => {
    if (v === '12h30m') return 187.5;
    return null;
  }),
  parseDecCoordinate: jest.fn((v: string) => {
    if (v === '+45d00m') return 45;
    return null;
  }),
}));

import { GoToCoordinatesDialog } from '../go-to-coordinates-dialog';

describe('GoToCoordinatesDialog', () => {
  it('renders when open', () => {
    render(<GoToCoordinatesDialog open={true} onOpenChange={jest.fn()} onNavigate={jest.fn()} />);
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<GoToCoordinatesDialog open={false} onOpenChange={jest.fn()} onNavigate={jest.fn()} />);
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('displays RA and Dec input fields', () => {
    render(<GoToCoordinatesDialog open={true} onOpenChange={jest.fn()} onNavigate={jest.fn()} />);
    expect(screen.getByPlaceholderText('coordinates.raPlaceholder')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('coordinates.decPlaceholder')).toBeInTheDocument();
  });

  it('updates RA input value on change', () => {
    render(<GoToCoordinatesDialog open={true} onOpenChange={jest.fn()} onNavigate={jest.fn()} />);
    const raInput = screen.getByPlaceholderText('coordinates.raPlaceholder');
    fireEvent.change(raInput, { target: { value: '12h30m' } });
    expect(raInput).toHaveValue('12h30m');
  });

  it('updates Dec input value on change', () => {
    render(<GoToCoordinatesDialog open={true} onOpenChange={jest.fn()} onNavigate={jest.fn()} />);
    const decInput = screen.getByPlaceholderText('coordinates.decPlaceholder');
    fireEvent.change(decInput, { target: { value: '+45d00m' } });
    expect(decInput).toHaveValue('+45d00m');
  });

  it('calls onNavigate with parsed coords on valid submission', () => {
    const onNavigate = jest.fn();
    const onOpenChange = jest.fn();
    render(<GoToCoordinatesDialog open={true} onOpenChange={onOpenChange} onNavigate={onNavigate} />);

    fireEvent.change(screen.getByPlaceholderText('coordinates.raPlaceholder'), { target: { value: '12h30m' } });
    fireEvent.change(screen.getByPlaceholderText('coordinates.decPlaceholder'), { target: { value: '+45d00m' } });

    // Click Go To button (second button in footer)
    const buttons = screen.getAllByRole('button');
    const goToButton = buttons.find(b => b.textContent === 'coordinates.goTo');
    fireEvent.click(goToButton!);

    expect(onNavigate).toHaveBeenCalledWith(187.5, 45);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows error on invalid coordinates', () => {
    const onNavigate = jest.fn();
    render(<GoToCoordinatesDialog open={true} onOpenChange={jest.fn()} onNavigate={onNavigate} />);

    fireEvent.change(screen.getByPlaceholderText('coordinates.raPlaceholder'), { target: { value: 'invalid' } });
    fireEvent.change(screen.getByPlaceholderText('coordinates.decPlaceholder'), { target: { value: 'bad' } });

    const buttons = screen.getAllByRole('button');
    const goToButton = buttons.find(b => b.textContent === 'coordinates.goTo');
    fireEvent.click(goToButton!);

    expect(onNavigate).not.toHaveBeenCalled();
    expect(screen.getByText('coordinates.invalidCoordinates')).toBeInTheDocument();
  });

  it('clears error when input changes after error', () => {
    render(<GoToCoordinatesDialog open={true} onOpenChange={jest.fn()} onNavigate={jest.fn()} />);

    // Trigger error
    const buttons = screen.getAllByRole('button');
    const goToButton = buttons.find(b => b.textContent === 'coordinates.goTo');
    fireEvent.click(goToButton!);
    expect(screen.getByText('coordinates.invalidCoordinates')).toBeInTheDocument();

    // Change RA input — error should clear
    fireEvent.change(screen.getByPlaceholderText('coordinates.raPlaceholder'), { target: { value: '12h30m' } });
    expect(screen.queryByText('coordinates.invalidCoordinates')).not.toBeInTheDocument();
  });

  it('resets state when cancel is clicked', () => {
    render(<GoToCoordinatesDialog open={true} onOpenChange={jest.fn()} onNavigate={jest.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('coordinates.raPlaceholder'), { target: { value: '12h30m' } });

    const cancelButton = screen.getAllByRole('button').find(b => b.textContent === 'common.cancel');
    fireEvent.click(cancelButton!);

    // After cancel, re-render open and inputs should be empty
    expect(screen.getByPlaceholderText('coordinates.raPlaceholder')).toHaveValue('');
  });

  it('displays dialog title', () => {
    render(<GoToCoordinatesDialog open={true} onOpenChange={jest.fn()} onNavigate={jest.fn()} />);
    expect(screen.getByText('coordinates.goToCoordinates')).toBeInTheDocument();
  });
});
