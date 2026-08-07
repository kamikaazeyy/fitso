import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { MetricScoreRing } from '@/components/MetricScoreRing';

describe('MetricScoreRing', () => {
  it('renders the default label and sublabel', () => {
    render(<MetricScoreRing score={82} />);

    expect(screen.getByText('Score')).toBeTruthy();
    expect(screen.getByText('Excellent')).toBeTruthy();
    expect(screen.getByText('82')).toBeTruthy();
  });

  it('rounds the score for display', () => {
    render(<MetricScoreRing score={82.6} />);

    expect(screen.getByText('83')).toBeTruthy();
  });

  it('renders custom labels', () => {
    render(<MetricScoreRing score={40} label="Strain" sublabel="Moderate" />);

    expect(screen.getByText('Strain')).toBeTruthy();
    expect(screen.getByText('Moderate')).toBeTruthy();
  });

  it('renders at a custom size', () => {
    render(<MetricScoreRing score={50} size={120} />);

    expect(screen.getByText('50')).toBeTruthy();
  });
});
