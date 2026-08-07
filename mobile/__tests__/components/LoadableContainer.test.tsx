import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { LoadableContainer } from '@/components/LoadableContainer';

const child = <Text>child content</Text>;

describe('LoadableContainer', () => {
  it('renders the loading state with a custom message', () => {
    render(
      <LoadableContainer status="loading" loadingMessage="Loading meals..." emptyTitle="Nothing">
        {child}
      </LoadableContainer>
    );

    expect(screen.getByText('Loading meals...')).toBeTruthy();
    expect(screen.queryByText('child content')).toBeNull();
  });

  it('falls back to the default loading message', () => {
    render(
      <LoadableContainer status="loading" emptyTitle="Nothing">
        {child}
      </LoadableContainer>
    );

    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('renders the empty title and subtitle when empty', () => {
    render(
      <LoadableContainer status="empty" emptyTitle="No meals" emptySubtitle="Log one to start">
        {child}
      </LoadableContainer>
    );

    expect(screen.getByText('No meals')).toBeTruthy();
    expect(screen.getByText('Log one to start')).toBeTruthy();
    expect(screen.queryByText('child content')).toBeNull();
  });

  it('shows the error instead of the empty title and hides the subtitle', () => {
    render(
      <LoadableContainer
        status="empty"
        emptyTitle="No meals"
        emptySubtitle="Log one to start"
        error="Network unreachable"
      >
        {child}
      </LoadableContainer>
    );

    expect(screen.getByText('Network unreachable')).toBeTruthy();
    expect(screen.queryByText('No meals')).toBeNull();
    expect(screen.queryByText('Log one to start')).toBeNull();
  });

  it('renders children once data is available', () => {
    render(
      <LoadableContainer status="data" emptyTitle="No meals">
        {child}
      </LoadableContainer>
    );

    expect(screen.getByText('child content')).toBeTruthy();
  });
});
