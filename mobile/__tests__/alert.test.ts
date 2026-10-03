import { Alert, Platform } from 'react-native';
import { showAlert } from '@/src/utils/alert';

describe('showAlert', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'confirm');
    jest.restoreAllMocks();
  });

  it('calls the non-cancel action when the web confirmation is accepted', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const confirm = jest.fn().mockReturnValue(true);
    Object.defineProperty(window, 'confirm', { configurable: true, value: confirm });
    const onPress = jest.fn();

    showAlert('Discard workout?', 'All progress will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress },
    ]);

    expect(confirm).toHaveBeenCalledWith('Discard workout?\n\nAll progress will be lost.');
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call the non-cancel action when the web confirmation is declined', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const confirm = jest.fn().mockReturnValue(false);
    Object.defineProperty(window, 'confirm', { configurable: true, value: confirm });
    const onPress = jest.fn();
    const onCancel = jest.fn();

    showAlert('Discard workout?', 'All progress will be lost.', [
      { text: 'Cancel', style: 'cancel', onPress: onCancel },
      { text: 'Discard', style: 'destructive', onPress },
    ]);

    expect(onPress).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('passes through to Alert.alert on native', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const buttons = [{ text: 'OK', onPress: jest.fn() }];
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    showAlert('Saved', 'Workout saved.', buttons);

    expect(alert).toHaveBeenCalledWith('Saved', 'Workout saved.', buttons);
  });
});
