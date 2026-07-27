export const colors = {
  background: '#000000',
  surface: '#1C1C1E',
  surfaceAlt: '#121212',
  card: '#1C1C1E',
  cardBorder: '#2C2C2E',
  label: '#A0A0A0',
  white: '#FFFFFF',
  cta: '#E63946',
  ctaDark: '#B71C1C',
  cyan: '#00E5FF',
  yellow: '#FFD600',
  purple: '#B388FF',
  energy: '#E63946',
  recovery: '#00E5FF',
  recoveryAlt: '#FFD600',
  sleep: '#B388FF',
  health: '#00E5FF',
};

export const radii = {
  card: 24,
  button: 20,
  tile: 20,
  full: 9999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
};

export const typography = {
  h1: { fontSize: 40, fontWeight: '800' as const, letterSpacing: -1 },
  h2: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
  h3: { fontSize: 20, fontWeight: '700' as const },
  body: { fontSize: 14, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '500' as const },
  metric: { fontSize: 32, fontWeight: '800' as const, letterSpacing: -0.75 },
};
