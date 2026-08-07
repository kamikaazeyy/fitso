module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^@expo/vector-icons/Ionicons$': '<rootDir>/__mocks__/ioniconsMock.js',
    '^@/(.*)$': '<rootDir>/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|nativewind|react-native-css-interop|react-native-circular-progress-indicator)',
  ],
  collectCoverageFrom: [
    'api/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'context/**/*.{ts,tsx}',
    'constants/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/dist-android/'],
};
