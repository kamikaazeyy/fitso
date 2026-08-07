import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StatTile } from '@/components/StatTile';

describe('StatTile', () => {
  it('renders the title, value and unit', () => {
    render(<StatTile title="Resting HR" value={54} unit="bpm" />);

    expect(screen.getByText('Resting HR')).toBeTruthy();
    expect(screen.getByText('54')).toBeTruthy();
    expect(screen.getByText('bpm')).toBeTruthy();
  });

  it('shows a dash for a flat trend', () => {
    render(<StatTile title="HRV" value={62} unit="ms" trend={0} />);

    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByLabelText('icon-remove')).toBeTruthy();
  });

  it('shows an upward trend as a positive percentage', () => {
    render(<StatTile title="HRV" value={62} unit="ms" trend={12} />);

    expect(screen.getByText('12%')).toBeTruthy();
    expect(screen.getByLabelText('icon-trending-up')).toBeTruthy();
  });

  it('shows a downward trend as an absolute percentage', () => {
    render(<StatTile title="HRV" value={62} unit="ms" trend={-8} />);

    expect(screen.getByText('8%')).toBeTruthy();
    expect(screen.getByLabelText('icon-trending-down')).toBeTruthy();
  });

  it('renders a custom icon with the given color', () => {
    const IconSpy = jest.fn((_props: { size?: number; color?: string }) => null);

    render(
      <StatTile title="Sleep" value="7.4" unit="h" icon={IconSpy} color="#FFD600" />
    );

    expect(IconSpy).toHaveBeenCalledWith(
      expect.objectContaining({ size: 18, color: '#FFD600' }),
      undefined
    );
  });

  it('renders string values as given', () => {
    render(<StatTile title="Sleep" value="7.4" unit="h" />);

    expect(screen.getByText('7.4')).toBeTruthy();
  });
});
