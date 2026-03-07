/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { LoadingOverlay } from '../components/loading-overlay';

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('LoadingOverlay', () => {
  const mockOnRetry = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders nothing when not loading and no error', () => {
      const { container } = render(
        <LoadingOverlay
          loadingState={{
            isLoading: false,
            loadingStatus: '',
            errorMessage: null,
            startTime: null,
            progress: 0,
          }}
          onRetry={mockOnRetry}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('renders loading overlay when isLoading is true', () => {
      render(
        <LoadingOverlay
          loadingState={{
            isLoading: true,
            loadingStatus: 'Loading engine...',
            errorMessage: null,
            startTime: null,
            progress: 20,
          }}
          onRetry={mockOnRetry}
        />
      );

      expect(screen.getByText('Loading engine...')).toBeInTheDocument();
    });

    it('renders spinner during loading', () => {
      const { container } = render(
        <LoadingOverlay
          loadingState={{
            isLoading: true,
            loadingStatus: 'Initializing...',
            errorMessage: null,
            startTime: null,
            progress: 40,
          }}
          onRetry={mockOnRetry}
        />
      );

      // Spinner should have animate-spin class
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('renders error message when errorMessage is set', () => {
      render(
        <LoadingOverlay
          loadingState={{
            isLoading: false,
            loadingStatus: 'Failed',
            errorMessage: 'Script load failed',
            startTime: null,
            progress: 0,
          }}
          onRetry={mockOnRetry}
        />
      );

      expect(screen.getByText('Script load failed')).toBeInTheDocument();
    });

    it('renders retry button when error occurs', () => {
      render(
        <LoadingOverlay
          loadingState={{
            isLoading: false,
            loadingStatus: 'Error',
            errorMessage: 'Connection failed',
            startTime: null,
            progress: 0,
          }}
          onRetry={mockOnRetry}
        />
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();
    });

    it('renders retry button for timed_out phase even without explicit error message', () => {
      render(
        <LoadingOverlay
          loadingState={{
            isLoading: false,
            loadingStatus: 'Timed out',
            errorMessage: null,
            startTime: null,
            progress: 100,
            phase: 'timed_out',
          }}
          onRetry={mockOnRetry}
        />
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();
    });

    it('does not render spinner when there is an error', () => {
      const { container } = render(
        <LoadingOverlay
          loadingState={{
            isLoading: true,
            loadingStatus: 'Error',
            errorMessage: 'Something went wrong',
            startTime: null,
            progress: 0,
          }}
          onRetry={mockOnRetry}
        />
      );

      // Spinner should not be present when there's an error
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeNull();
    });
  });

  describe('Interactions', () => {
    it('calls onRetry when retry button is clicked', () => {
      render(
        <LoadingOverlay
          loadingState={{
            isLoading: false,
            loadingStatus: 'Error',
            errorMessage: 'Load failed',
            startTime: null,
            progress: 0,
          }}
          onRetry={mockOnRetry}
        />
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);

      expect(mockOnRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('Styling', () => {
    it('has correct overlay styling', () => {
      const { container } = render(
        <LoadingOverlay
          loadingState={{
            isLoading: true,
            loadingStatus: 'Loading...',
            errorMessage: null,
            startTime: null,
            progress: 50,
          }}
          onRetry={mockOnRetry}
        />
      );

      const overlay = container.firstChild as HTMLElement;
      expect(overlay).toHaveClass('absolute', 'inset-0');
    });

    it('shows error message with destructive styling', () => {
      render(
        <LoadingOverlay
          loadingState={{
            isLoading: false,
            loadingStatus: 'Error',
            errorMessage: 'Critical error',
            startTime: null,
            progress: 0,
          }}
          onRetry={mockOnRetry}
        />
      );

      const errorText = screen.getByText('Critical error');
      expect(errorText).toHaveClass('text-destructive');
    });
  });

  describe('Loading Status Display', () => {
    it('displays loading status message', () => {
      render(
        <LoadingOverlay
          loadingState={{
            isLoading: true,
            loadingStatus: 'Preparing resources...',
            errorMessage: null,
            startTime: null,
            progress: 10,
          }}
          onRetry={mockOnRetry}
        />
      );

      expect(screen.getByText('Preparing resources...')).toBeInTheDocument();
    });

    it('displays status message even with error', () => {
      render(
        <LoadingOverlay
          loadingState={{
            isLoading: false,
            loadingStatus: 'Initialization failed',
            errorMessage: 'WASM error',
            startTime: null,
            progress: 0,
          }}
          onRetry={mockOnRetry}
        />
      );

      expect(screen.getByText('Initialization failed')).toBeInTheDocument();
      expect(screen.getByText('WASM error')).toBeInTheDocument();
    });
  });
});
