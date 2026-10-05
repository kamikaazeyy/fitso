export const STANDARD_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];

export interface PlateResult {
  /** Plates to load on each side, largest first. */
  platesPerSide: number[];
  /** Per-side weight left over that the plate set can't represent. */
  remainderKg: number;
  /** What you'll actually lift: bar + plates × 2. */
  achievedKg: number;
}

/**
 * Greedy largest-first plate breakdown. Returns the best achievable load —
 * when the target isn't representable, `remainderKg` shows the shortfall so
 * the UI can say "closest is X".
 */
export function platesFor(
  targetKg: number,
  barKg: number,
  plates: number[] = STANDARD_PLATES_KG
): PlateResult {
  let perSide = Math.max(0, (targetKg - barKg) / 2);
  const platesPerSide: number[] = [];

  for (const plate of plates) {
    while (perSide >= plate - 1e-9) {
      platesPerSide.push(plate);
      perSide -= plate;
    }
  }

  const loaded = platesPerSide.reduce((sum, plate) => sum + plate, 0);
  return {
    platesPerSide,
    remainderKg: Math.max(0, perSide),
    achievedKg: barKg + loaded * 2,
  };
}
