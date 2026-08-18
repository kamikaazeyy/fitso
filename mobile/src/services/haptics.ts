import * as Haptics from 'expo-haptics';

/**
 * Fire-and-forget haptics. The tracker never awaits feedback: a dropped
 * vibration must not delay a set being logged.
 */
export function tapFeedback(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

export function successFeedback(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

export function heavyFeedback(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
}
