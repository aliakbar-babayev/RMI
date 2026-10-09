import { Level } from './types';

export const colors = {
  bg: '#0b0b0d',
  text: '#f4f4f6',
  muted: '#8e8e98',
  card: '#16161a',
  raised: '#1e1e23',
  glass: '#1e1e23',
  input: '#1e1e23',
  line: '#2b2b31',
  lavender: '#1e1e23',
  pink: '#2b1a16',
  sky: '#1b1f24',
  ink: '#1d1d22',
  accent: '#f47b20',
  indigo: '#f47b20',
  magenta: '#e85d1c',
  ok: '#8fa75a',
  warn: '#e4a23b',
  danger: '#d4493b',
};

export const bgGradient = ['#0b0b0d', '#0b0b0d', '#101014'] as const;

export const levelColor: Record<Level, string> = {
  low: '#8fa75a',
  medium: '#c9bb43',
  high: '#e48b3b',
  critical: '#d4493b',
};

export const levelLabel: Record<Level, string> = {
  low: 'LOW',
  medium: 'MEDIUM',
  high: 'HIGH',
  critical: 'EXTREME',
};

export const levelGradient: Record<Level, readonly [string, string]> = {
  low: ['#a3b866', '#8fa75a'],
  medium: ['#d6c84c', '#c9bb43'],
  high: ['#ee9a45', '#e48b3b'],
  critical: ['#e48b3b', '#d4493b'],
};

// Matrix cell color: smooth green → yellow → orange → red from bottom-left to top-right.
const STOPS = ['#8a9e58', '#c4b948', '#e0893c', '#d24c3c'];
const mix = (a: string, b: string, t: number) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, k) => Math.round(v + (pb[k] - v) * t).toString(16).padStart(2, '0')).join('');
};
export const matrixColor = (p: number, i: number) => {
  const t = ((p + i - 2) / 8) * (STOPS.length - 1);
  const k = Math.min(STOPS.length - 2, Math.floor(t));
  return mix(STOPS[k], STOPS[k + 1], t - k);
};
export const zoneColor = matrixColor;

export const font = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.35,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 4,
};
