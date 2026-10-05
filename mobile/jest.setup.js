/* eslint-env jest */

// Native boundaries (`react-native-mmkv`, `expo-haptics`, `expo-notifications`,
// `@op-engineering/op-sqlite`) are replaced automatically by the manual mocks in
// `__mocks__/`, which Jest applies to node modules without an explicit opt-in.

// The Live Activity widget target only exists in a custom native build.
jest.mock('expo-widgets', () => ({}), { virtual: true });
