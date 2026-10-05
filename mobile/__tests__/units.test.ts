import { displayWeight, formatWeight, kgToLbs, lbsToKg, parseWeightInput } from '@/src/utils/units';
import { platesFor, STANDARD_PLATES_KG } from '@/src/utils/plateMath';

describe('units', () => {
  it('converts kg ↔ lbs', () => {
    expect(kgToLbs(100)).toBeCloseTo(220.4623, 3);
    expect(lbsToKg(220.4623)).toBeCloseTo(100, 3);
  });

  it('displayWeight rounds lbs to one decimal, passes kg through', () => {
    expect(displayWeight(95, 'lbs')).toBe(209.4);
    expect(displayWeight(95, 'kg')).toBe(95);
    expect(displayWeight(null, 'lbs')).toBeNull();
  });

  it('formatWeight appends the unit and handles null', () => {
    expect(formatWeight(95, 'kg')).toBe('95 kg');
    expect(formatWeight(95, 'lbs')).toBe('209.4 lbs');
    expect(formatWeight(null, 'kg')).toBe('—');
  });

  it('parseWeightInput converts display values back to canonical kg', () => {
    expect(parseWeightInput('100', 'kg')).toBe(100);
    expect(parseWeightInput('220.4623', 'lbs')).toBeCloseTo(100, 3);
    expect(parseWeightInput('', 'lbs')).toBeNull();
    expect(parseWeightInput('abc', 'kg')).toBeNull();
    expect(parseWeightInput('-5', 'kg')).toBeNull();
  });
});

describe('platesFor', () => {
  it('breaks 100kg on a 20kg bar into 25+15 per side', () => {
    const result = platesFor(100, 20);
    expect(result.platesPerSide).toEqual([25, 15]);
    expect(result.achievedKg).toBe(100);
    expect(result.remainderKg).toBe(0);
  });

  it('handles the bar alone', () => {
    const result = platesFor(20, 20);
    expect(result.platesPerSide).toEqual([]);
    expect(result.achievedKg).toBe(20);
  });

  it('returns the closest achievable load when the target is unrepresentable', () => {
    const result = platesFor(61, 20); // 20.5 per side → 20 + 0.5 remainder
    expect(result.platesPerSide).toEqual([20]);
    expect(result.remainderKg).toBeCloseTo(0.5, 6);
    expect(result.achievedKg).toBe(60);
  });

  it('uses small plates for fractional targets', () => {
    const result = platesFor(32.5, 20); // 6.25 per side → 5 + 1.25
    expect(result.platesPerSide).toEqual([5, 1.25]);
    expect(result.achievedKg).toBeCloseTo(32.5, 6);
  });

  it('respects a custom plate set', () => {
    const result = platesFor(60, 20, [10, 5, 2.5]);
    expect(result.platesPerSide).toEqual([10, 10]);
    expect(STANDARD_PLATES_KG).toContain(1.25); // sanity: default unchanged
  });
});
