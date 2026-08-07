import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Circle } from 'react-native-svg';
import { SegmentedCalorieRing } from '@/components/SegmentedCalorieRing';

const MACROS = [
  { label: 'Carbs', current: 100, target: 200, color: '#38BDF8' },
  { label: 'Protein', current: 50, target: 100, color: '#FACC15' },
  { label: 'Fats', current: 20, target: 40, color: '#C084FC' },
];

function renderRing(props: Partial<React.ComponentProps<typeof SegmentedCalorieRing>> = {}) {
  const view = render(
    <SegmentedCalorieRing
      calories={{ current: 640, target: 1500 }}
      macros={MACROS}
      dayLabel="Day 12"
      {...props}
    />
  );
  const circles = view.UNSAFE_root.findAllByType(Circle);
  return { view, track: circles[0], segments: circles.slice(1) };
}

function dashLength(circle: ReturnType<typeof renderRing>['track']): number {
  const [length] = String(circle.props.strokeDasharray).split(' ');
  return Number(length);
}

describe('SegmentedCalorieRing', () => {
  it('renders the day label and calorie totals', () => {
    renderRing();

    expect(screen.getByText('Day 12')).toBeTruthy();
    expect(screen.getByText('640')).toBeTruthy();
    expect(screen.getByText('1500 kcal')).toBeTruthy();
  });

  it('renders a background track plus one arc per macro', () => {
    const { track, segments } = renderRing();

    expect(track.props.stroke).toBe('#2C2C2E');
    expect(segments).toHaveLength(MACROS.length);
    expect(segments.map((s) => s.props.stroke)).toEqual([
      '#38BDF8',
      '#FACC15',
      '#C084FC',
    ]);
  });

  it('derives the radius from size and stroke width', () => {
    const { track } = renderRing({ size: 200, strokeWidth: 20 });

    expect(track.props.r).toBe(90);
    expect(track.props.cx).toBe(100);
    expect(track.props.cy).toBe(100);
  });

  it('scales fats by 9 kcal/g and other macros by 4 kcal/g', () => {
    // Carbs: 100g -> 400 kcal, Fats: 100g -> 900 kcal, so fats gets the longer arc.
    const { segments } = renderRing({
      macros: [
        { label: 'Carbs', current: 100, target: 100, color: '#38BDF8' },
        { label: 'Fats', current: 100, target: 100, color: '#C084FC' },
      ],
    });

    expect(dashLength(segments[1]) / dashLength(segments[0])).toBeCloseTo(9 / 4);
  });

  it('treats unknown macro labels as 4 kcal/g', () => {
    const { segments } = renderRing({
      macros: [
        { label: 'Protein', current: 50, target: 100, color: '#FACC15' },
        { label: 'Fiber', current: 50, target: 100, color: '#4ADE80' },
      ],
    });

    expect(dashLength(segments[1])).toBeCloseTo(dashLength(segments[0]));
  });

  it('gives a fully logged macro an arc twice as long as a half logged one', () => {
    const { segments } = renderRing({
      macros: [
        { label: 'Carbs', current: 100, target: 200, color: '#38BDF8' },
        { label: 'Protein', current: 200, target: 200, color: '#FACC15' },
      ],
    });

    expect(dashLength(segments[1]) / dashLength(segments[0])).toBeCloseTo(2);
  });

  it('offsets each arc after the previous one plus the gap', () => {
    const { segments } = renderRing({ macros: MACROS, gap: 24 });

    expect(segments[0].props.strokeDashoffset).toBe(-0);
    expect(-segments[1].props.strokeDashoffset).toBeGreaterThan(0);
    expect(-segments[2].props.strokeDashoffset).toBeGreaterThan(
      -segments[1].props.strokeDashoffset
    );
  });

  it('renders zero-length arcs when nothing is logged', () => {
    const { segments } = renderRing({
      macros: MACROS.map((macro) => ({ ...macro, current: 0 })),
    });

    expect(segments.map(dashLength)).toEqual([0, 0, 0]);
  });

  it('does not divide by zero when every macro target is zero', () => {
    const { segments } = renderRing({
      macros: [{ label: 'Carbs', current: 0, target: 0, color: '#38BDF8' }],
    });

    expect(dashLength(segments[0])).toBe(0);
  });

  it('renders nothing but the track when there are no macros', () => {
    const { segments } = renderRing({ macros: [] });

    expect(segments).toHaveLength(0);
  });
});
