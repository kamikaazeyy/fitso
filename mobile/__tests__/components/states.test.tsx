import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { EmptyState } from '@/components/EmptyState';
import { LoadingState } from '@/components/LoadingState';
import { GlassCard } from '@/components/GlassCard';

describe('EmptyState', () => {
  it('renders the title and subtitle', () => {
    render(<EmptyState title="No exercises" subtitle="Try another search" />);

    expect(screen.getByText('No exercises')).toBeTruthy();
    expect(screen.getByText('Try another search')).toBeTruthy();
  });

  it('omits the subtitle when not provided', () => {
    render(<EmptyState title="No exercises" />);

    expect(screen.getByText('No exercises')).toBeTruthy();
    expect(screen.queryByText('Try another search')).toBeNull();
  });
});

describe('LoadingState', () => {
  it('renders the default message', () => {
    render(<LoadingState />);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('renders a custom message', () => {
    render(<LoadingState message="Fetching exercises" />);
    expect(screen.getByText('Fetching exercises')).toBeTruthy();
  });
});

describe('GlassCard', () => {
  it('renders its children', () => {
    render(
      <GlassCard>
        <Text>inside the card</Text>
      </GlassCard>
    );

    expect(screen.getByText('inside the card')).toBeTruthy();
  });

  it('merges a caller style and forwards extra view props', () => {
    render(
      <GlassCard testID="card" style={{ marginTop: 12 }}>
        <Text>inside the card</Text>
      </GlassCard>
    );

    expect(screen.getByTestId('card')).toHaveStyle({ overflow: 'hidden', marginTop: 12 });
  });
});
