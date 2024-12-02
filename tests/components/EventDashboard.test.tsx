import { render, screen } from '@testing-library/react';
import { EventDashboard } from '@/components/EventDashboard';
import { vi } from 'vitest';
import { useQuery } from '@tanstack/react-query';

const mockUseQuery = useQuery as jest.Mock;

describe('EventDashboard', () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });
  });

  it('renders loading state initially', () => {
    render(<EventDashboard />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('displays event statistics when data is loaded', () => {
    mockUseQuery.mockReturnValue({
      data: {
        totalEvents: 10,
        upcomingEvents: 5,
        prefectureStats: {
          "東京都": 3,
          "大阪府": 2,
        },
      },
      isLoading: false,
      error: null,
    });

    render(<EventDashboard />);
    
    expect(screen.getByText('総イベント数')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('開催予定')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });
});