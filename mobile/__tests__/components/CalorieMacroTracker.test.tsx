import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import {
  CalorieMacroTracker,
  DUMMY_NUTRITION,
  type NutritionData,
} from '@/components/CalorieMacroTracker';

const MINIMAL: NutritionData = {
  date: 'Today',
  calories: { consumed: 600, target: 2000 },
  macros: [{ id: 'm1', label: 'Carbs', current: 60, target: 200, color: '#38BDF8' }],
  meals: [
    {
      id: 'meal1',
      label: 'Breakfast',
      icon: 'cafe-outline',
      items: [
        {
          id: 'f1',
          name: 'Oatmeal',
          serving: '1 bowl',
          calories: 320,
          protein: 12,
          carbs: 54,
          fats: 6,
        },
      ],
    },
  ],
};

describe('CalorieMacroTracker', () => {
  it('always renders the section label', () => {
    render(<CalorieMacroTracker data={null} status="loading" />);

    expect(screen.getByText('Nutrition')).toBeTruthy();
  });

  it('shows the loading state while loading', () => {
    render(<CalorieMacroTracker data={null} status="loading" />);

    expect(screen.getByText('Loading nutrition...')).toBeTruthy();
    expect(screen.queryByText('Breakfast')).toBeNull();
  });

  it('shows the empty state when there is no data', () => {
    render(<CalorieMacroTracker data={null} status="empty" />);

    expect(screen.getByText('No nutrition data')).toBeTruthy();
    expect(
      screen.getByText('Log your first meal to see macros and calories.')
    ).toBeTruthy();
  });

  it('renders nothing but the shell when the status is data but data is null', () => {
    render(<CalorieMacroTracker data={null} status="data" />);

    expect(screen.getByText('Nutrition')).toBeTruthy();
    expect(screen.queryByText('Breakfast')).toBeNull();
  });

  it('renders calories consumed against the target', () => {
    render(<CalorieMacroTracker data={MINIMAL} status="data" />);

    expect(screen.getByText('600')).toBeTruthy();
    expect(screen.getByText('of 2000')).toBeTruthy();
  });

  it('renders the remaining calories', () => {
    render(<CalorieMacroTracker data={MINIMAL} status="data" />);

    expect(screen.getByText('1400 kcal left')).toBeTruthy();
  });

  it('renders a negative remainder when over the target', () => {
    render(
      <CalorieMacroTracker
        data={{ ...MINIMAL, calories: { consumed: 2200, target: 2000 } }}
        status="data"
      />
    );

    expect(screen.getByText('-200 kcal left')).toBeTruthy();
  });

  it('renders each macro with its current and target grams', () => {
    render(<CalorieMacroTracker data={MINIMAL} status="data" />);

    expect(screen.getByText('Carbs')).toBeTruthy();
    expect(screen.getByText('60')).toBeTruthy();
    expect(screen.getByText('60 / 200g')).toBeTruthy();
  });

  it('renders every macro in the list', () => {
    render(<CalorieMacroTracker data={DUMMY_NUTRITION} status="data" />);

    for (const macro of DUMMY_NUTRITION.macros) {
      expect(screen.getByText(macro.label)).toBeTruthy();
    }
  });

  it('sums the calories of the items in each meal', () => {
    render(<CalorieMacroTracker data={DUMMY_NUTRITION} status="data" />);

    // Breakfast: 320 + 130 + 115
    expect(screen.getByText('565 kcal')).toBeTruthy();
    // Dinner: 367 + 112
    expect(screen.getByText('479 kcal')).toBeTruthy();
  });

  it('renders the macro summary line for each food item', () => {
    render(<CalorieMacroTracker data={MINIMAL} status="data" />);

    expect(screen.getByText('Oatmeal')).toBeTruthy();
    expect(screen.getByText('1 bowl · P12g · C54g · F6g')).toBeTruthy();
  });

  it('shows a placeholder for a meal with no items', () => {
    render(
      <CalorieMacroTracker
        data={{
          ...MINIMAL,
          meals: [{ id: 'meal1', label: 'Snacks', icon: 'restaurant-outline', items: [] }],
        }}
        status="data"
      />
    );

    expect(screen.getByText('No foods logged yet.')).toBeTruthy();
    expect(screen.getByText('0 kcal')).toBeTruthy();
  });

  it('renders one Add Food button per meal', () => {
    render(<CalorieMacroTracker data={DUMMY_NUTRITION} status="data" />);

    expect(screen.getAllByText('Add Food')).toHaveLength(DUMMY_NUTRITION.meals.length);
  });

  it('alerts that food logging is not implemented yet', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    render(<CalorieMacroTracker data={MINIMAL} status="data" />);

    fireEvent.press(screen.getByText('Add Food'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Coming soon',
      'Food logging is under development.'
    );
    alertSpy.mockRestore();
  });
});

describe('DUMMY_NUTRITION', () => {
  it('keeps consumed calories under the target and macros under their targets', () => {
    expect(DUMMY_NUTRITION.calories.consumed).toBeLessThan(
      DUMMY_NUTRITION.calories.target
    );
    for (const macro of DUMMY_NUTRITION.macros) {
      expect(macro.current).toBeLessThanOrEqual(macro.target);
    }
  });

  it('has unique meal and food ids', () => {
    const mealIds = DUMMY_NUTRITION.meals.map((meal) => meal.id);
    const foodIds = DUMMY_NUTRITION.meals.flatMap((meal) => meal.items.map((i) => i.id));

    expect(new Set(mealIds).size).toBe(mealIds.length);
    expect(new Set(foodIds).size).toBe(foodIds.length);
  });
});
