import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createMMKVJSONStorage } from '@/src/store/mmkvStorage';
import type { WeightUnit } from '@/src/utils/units';

export const SETTINGS_STORAGE_KEY = 'fitso.settings';

export interface SettingsState {
  /** Display/input unit — stored values stay canonical kg in SQLite. */
  weightUnit: WeightUnit;
  /** Rest timer default for exercises without their own rest_seconds. */
  defaultRestSeconds: number;
  /** Bar weight used by the plate calculator. */
  defaultBarWeightKg: number;
}

export interface SettingsActions {
  setWeightUnit: (unit: WeightUnit) => void;
  setDefaultRestSeconds: (seconds: number) => void;
  setDefaultBarWeightKg: (kg: number) => void;
}

export type SettingsStore = SettingsState & SettingsActions;

const initialState: SettingsState = {
  weightUnit: 'kg',
  defaultRestSeconds: 90,
  defaultBarWeightKg: 20,
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...initialState,
      setWeightUnit: (weightUnit) => set({ weightUnit }),
      setDefaultRestSeconds: (defaultRestSeconds) =>
        set({ defaultRestSeconds: Math.max(0, Math.round(defaultRestSeconds)) }),
      setDefaultBarWeightKg: (defaultBarWeightKg) =>
        set({ defaultBarWeightKg: Math.max(0, defaultBarWeightKg) }),
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      storage: createMMKVJSONStorage<SettingsState>(),
    }
  )
);
