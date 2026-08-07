import { Alert } from 'react-native';

export function showComingSoon(message: string) {
  Alert.alert('Coming soon', message);
}
