import { colors, radii, spacing, typography } from '@/constants/theme';

describe('theme tokens', () => {
  it('exposes every colour as a hex value', () => {
    for (const [name, value] of Object.entries(colors)) {
      expect(value).toMatch(/^#[0-9A-F]{6}$/i);
      expect(name).not.toBe('');
    }
  });

  it('exposes positive radii and spacing values', () => {
    for (const value of Object.values(radii)) {
      expect(value).toBeGreaterThan(0);
    }
    for (const value of Object.values(spacing)) {
      expect(value).toBeGreaterThan(0);
    }
  });

  it('scales spacing monotonically', () => {
    const scale = [
      spacing.xs,
      spacing.sm,
      spacing.md,
      spacing.lg,
      spacing.xl,
      spacing['2xl'],
    ];

    expect(scale).toEqual([...scale].sort((a, b) => a - b));
    expect(new Set(scale).size).toBe(scale.length);
  });

  it('gives every typography token a font size and weight', () => {
    for (const token of Object.values(typography)) {
      expect(token.fontSize).toBeGreaterThan(0);
      expect(Number(token.fontWeight)).toBeGreaterThan(0);
    }
  });

  it('orders heading sizes from largest to smallest', () => {
    expect(typography.h1.fontSize).toBeGreaterThan(typography.h2.fontSize);
    expect(typography.h2.fontSize).toBeGreaterThan(typography.h3.fontSize);
    expect(typography.h3.fontSize).toBeGreaterThan(typography.body.fontSize);
    expect(typography.body.fontSize).toBeGreaterThan(typography.caption.fontSize);
  });
});
