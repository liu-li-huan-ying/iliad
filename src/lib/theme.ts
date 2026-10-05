// Design tokens transcribed from docs-local/iliad.html.
export const colors = {
  bg: '#050608',
  card: '#0B0F17',
  hover: '#131824',
  accent: '#E8794A',
  accentSoft: 'rgba(232,121,74,.09)',
  accentBorder: 'rgba(232,121,74,.42)',
  accentGlow: 'rgba(232,121,74,.22)',
  text1: '#E8EAED',
  text2: '#9CA3AF',
  text3: '#5C6372',
  text4: '#3A3F4A',
  hairline: 'rgba(255,255,255,.09)',
  glass: 'rgba(255,255,255,.04)',
  ok: '#4FB783',
  warn: '#F0A060',
};

export const radius = { sm: 6, md: 10, card: 14, bar: 20, pill: 999 };

// 48dp is the Android minimum touch target; the prototype's 34/38px buttons are
// visual sizes, so the tappable box is separated from them.
export const touch = { min: 48 };

export const mono = {
  fontFamily: 'monospace',
  fontVariant: ['tabular-nums' as const],
};

export const spring = { type: 'spring', stiffness: 260, damping: 22 };

export const motion = {
  controlsHideAfter: 4200,
  toast: 2600,
  hud: 760,
  tapConflict: 250,
};

export const type = {
  page: 22,
  card: 16,
  body: 14,
  label: 13,
  // Anything informative stays >= 12sp: text3/text4 only clear 3.2:1 and 1.9:1.
  meta: 12,
  chip: 12,
};
