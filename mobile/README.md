# Fitso

A Bevel-inspired fitness dashboard built with **Expo + Expo Router + NativeWind v4 + React Native Reanimated**.

## Tech Stack

- **Framework:** Expo (SDK 51) with Expo Router
- **Styling:** NativeWind v4 (Tailwind CSS for React Native)
- **Icons:** `lucide-react-native`
- **Charts/Gauges:** `react-native-svg` + `react-native-reanimated`
- **Animations:** `react-native-reanimated`

## Quick Start (from this boilerplate)

```bash
cd /Users/pranavmehrotra/Desktop/fitso
npm install
npx expo start
```

Then press `i` for iOS or `a` for Android.

## Step 1 — Manual Project Setup

If you prefer to initialize a clean project from scratch and then merge these files:

```bash
# Create a new Expo app
npx create-expo-app@latest fitso --template blank

# Or use the tabs template for a faster router start
# npx create-expo-app@latest fitso --template tabs

cd fitso

# Install Expo Router and related packages
npx expo install expo-router expo-linking expo-constants expo-status-bar
npx expo install react-native-safe-area-context react-native-screens

# Install styling and UI dependencies
npm install nativewind@4.0.1 tailwindcss@3.4.1
npm install lucide-react-native react-native-reanimated react-native-svg

# Install dev dependencies
npm install -D @types/react typescript @babel/core

# Initialize Tailwind CSS
npx tailwindcss init
```

## Step 2 — Tailwind / NativeWind Configuration

The boilerplate already includes:

- `tailwind.config.js` — Bevel color palette and custom border radius.
- `global.css` — Tailwind directives.
- `metro.config.js` — `withNativeWind` wrapper.
- `babel.config.js` — `nativewind/babel` + `react-native-reanimated/plugin`.
- `nativewind-env.d.ts` — NativeWind type declarations.

## Step 3 — App Layout & Navigation

- `app/_layout.tsx` — Root layout with `SafeAreaProvider` and `global.css` import.
- `app/(tabs)/_layout.tsx` — Bottom tab bar with `Today`, `Journal`, `Analytics`, `Profile`.
- `app/(tabs)/index.tsx` — Dashboard screen.
- `app/(tabs)/journal.tsx` — Journal placeholder.
- `app/(tabs)/analytics.tsx` — Analytics placeholder.
- `app/(tabs)/profile.tsx` — Profile placeholder.

## Step 4 — Reusable Components

- `components/GlassCard.tsx` — Frosted/semi-transparent card with border.
- `components/MetricScoreRing.tsx` — Animated circular score gauge.
- `components/StatTile.tsx` — Metric tile with title, value, unit, and trend.

## Step 5 — Dashboard

`app/(tabs)/index.tsx` uses the components above and mock data from `constants/theme.ts` to render:

- Header with app name, date selector, and avatar.
- Hero `Recovery` score ring.
- 2x2 metrics grid: HRV, Sleep, Resting HR, Active Calories.
- `Log Workout` quick action.
- `Strain` progress card.

## File Structure

```
fitso/
├── app/
│   ├── _layout.tsx
│   └── (tabs)/
│       ├── _layout.tsx
│       ├── index.tsx
│       ├── journal.tsx
│       ├── analytics.tsx
│       └── profile.tsx
├── components/
│   ├── GlassCard.tsx
│   ├── MetricScoreRing.tsx
│   └── StatTile.tsx
├── constants/
│   └── theme.ts
├── babel.config.js
├── metro.config.js
├── tailwind.config.js
├── global.css
├── tsconfig.json
├── app.json
├── package.json
└── README.md
```

## Notes

- `mockData` lives in `app/(tabs)/index.tsx`; replace it with your API / health data source.
- The `MetricScoreRing` animates from `0` to the target score on mount.
- All colors are centralized in `constants/theme.ts` and mirrored in `tailwind.config.js`.
- NativeWind type errors in the editor will disappear after `npm install` is run.
