import { Alert, Platform } from 'react-native';
import type { AlertButton } from 'react-native';

export function showAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }

  const confirmButton = buttons?.find((button) => button.style !== 'cancel' && button.onPress);
  if (confirmButton) {
    const confirmed = window.confirm(`${title}\n\n${message ?? ''}`);
    if (confirmed) {
      confirmButton.onPress?.();
    } else {
      buttons?.find((button) => button.style === 'cancel')?.onPress?.();
    }
    return;
  }

  window.alert(message ? `${title}\n\n${message}` : title);
}
