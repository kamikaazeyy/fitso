import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { DatePickerStrip } from '@/components/DatePickerStrip';

// 2024-09-18 is a Wednesday.
const WEDNESDAY = new Date(2024, 8, 18);
const SUNDAY = new Date(2024, 8, 22);

describe('DatePickerStrip', () => {
  it('renders the Monday-to-Sunday week containing the selected date', () => {
    render(<DatePickerStrip selectedDate={WEDNESDAY} onSelectDate={jest.fn()} />);

    expect(screen.getAllByText('Mon')).toHaveLength(1);
    expect(screen.getAllByText('Sun')).toHaveLength(1);
    for (const day of ['16', '17', '18', '19', '20', '21', '22']) {
      expect(screen.getByText(day)).toBeTruthy();
    }
  });

  it('keeps a Sunday selection inside the same Monday-first week', () => {
    render(<DatePickerStrip selectedDate={SUNDAY} onSelectDate={jest.fn()} />);

    expect(screen.getByText('16')).toBeTruthy();
    expect(screen.getByText('22')).toBeTruthy();
    expect(screen.queryByText('23')).toBeNull();
  });

  it('passes the tapped date to onSelectDate', () => {
    const onSelectDate = jest.fn();
    render(<DatePickerStrip selectedDate={WEDNESDAY} onSelectDate={onSelectDate} />);

    fireEvent.press(screen.getByText('20'));

    expect(onSelectDate).toHaveBeenCalledTimes(1);
    const selected: Date = onSelectDate.mock.calls[0][0];
    expect(selected.getFullYear()).toBe(2024);
    expect(selected.getMonth()).toBe(8);
    expect(selected.getDate()).toBe(20);
  });

  it('spans a month boundary when the week straddles two months', () => {
    render(<DatePickerStrip selectedDate={new Date(2024, 8, 30)} onSelectDate={jest.fn()} />);

    expect(screen.getByText('30')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('6')).toBeTruthy();
  });

  it('does not mutate the selected date it was given', () => {
    const selected = new Date(2024, 8, 18);
    render(<DatePickerStrip selectedDate={selected} onSelectDate={jest.fn()} />);

    expect(selected.getTime()).toBe(new Date(2024, 8, 18).getTime());
  });

  it('highlights today when the current week is shown', () => {
    const today = new Date();
    render(<DatePickerStrip selectedDate={today} onSelectDate={jest.fn()} />);

    expect(screen.getByText(String(today.getDate()))).toBeTruthy();
  });
});
