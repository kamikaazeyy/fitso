import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';

interface DayItem {
  label: string;
  date: number;
  fullDate: Date;
  isToday: boolean;
}

interface DatePickerStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function DatePickerStrip({ selectedDate, onSelectDate }: DatePickerStripProps) {
  // Generate a week view centered around the selected date, but align to Mon-Sun display
  const startOfWeek = new Date(selectedDate);
  const dayOfWeek = startOfWeek.getDay(); // 0=Sun, 1=Mon...
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Make Monday first
  startOfWeek.setDate(startOfWeek.getDate() + diff);

  const days: DayItem[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    days.push({
      label: DAYS[d.getDay()],
      date: d.getDate(),
      fullDate: d,
      isToday,
    });
  }

  const isSelected = (d: Date) =>
    d.getDate() === selectedDate.getDate() &&
    d.getMonth() === selectedDate.getMonth() &&
    d.getFullYear() === selectedDate.getFullYear();

  return (
    <View className="flex-row items-center justify-between px-2">
      {days.map((day) => {
        const selected = isSelected(day.fullDate);
        return (
          <TouchableOpacity
            key={day.label + day.date}
            activeOpacity={0.7}
            onPress={() => onSelectDate(day.fullDate)}
            className="items-center"
          >
            <Text
              className={`text-xs font-medium mb-2 ${
                selected ? 'text-white' : 'text-[#A0A0A0]'
              }`}
            >
              {day.label}
            </Text>
            <View
              className={`w-10 h-10 rounded-full items-center justify-center border-2 ${
                selected
                  ? 'border-white bg-black'
                  : day.isToday
                  ? 'border-[#E63946] bg-[#E63946]'
                  : 'border-[#2C2C2E] bg-[#121212]'
              }`}
            >
              <Text
                className={`text-sm font-bold ${
                  selected ? 'text-white' : day.isToday ? 'text-white' : 'text-[#A0A0A0]'
                }`}
              >
                {day.date}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
