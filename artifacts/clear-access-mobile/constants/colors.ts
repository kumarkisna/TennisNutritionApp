// Mobile appearance is independent of the retained web planner.
import { extraLightThemes, extraDarkThemes } from './extra-themes';
const classic = {
    text: '#183542',
    tint: '#176d61',
    background: '#f7f4ed',
    foreground: '#183542',
    card: '#fbfaf6',
    cardForeground: '#183542',
    primary: '#176d61',
    primaryForeground: '#fbfaf6',
    secondary: '#f1ede4',
    secondaryForeground: '#183542',
    muted: '#f1ede4',
    mutedForeground: '#596863',
    accent: '#e8f3ed',
    accentForeground: '#176d61',
    destructive: '#a6473a',
    destructiveForeground: '#fbfaf6',
    destructiveSoft: '#fff0eb',
    border: '#e0d9ce',
    input: '#d9d2c5',
    ink: '#183542',
    inkSoft: '#b4cec5',
    mint: '#8acdb4',
    coral: '#ec8f76',
    inkForeground: '#fbfaf6',
    inkSecondary: '#2a4a58',
    destructiveBorder: '#efc8bf',
    accentBorder: '#c6ded5',
    chartMeasurement: '#b24c2d',
};

export type ThemePalette = typeof classic;
export type AppTheme = { id: string; name: string; mode: 'light' | 'dark'; palette: ThemePalette };

type PaletteOptions = {
  background: string; card: string; foreground: string; primary: string;
  secondary: string; accent: string; muted: string; border: string; ink: string;
};

function palette(mode: AppTheme['mode'], p: PaletteOptions): ThemePalette {
  const dark = mode === 'dark';
  const primaryForeground = dark ? '#071016' : '#ffffff';
  return {
    text: p.foreground, tint: p.primary, background: p.background,
    foreground: p.foreground, card: p.card, cardForeground: p.foreground,
    primary: p.primary, primaryForeground, secondary: p.secondary,
    secondaryForeground: p.foreground, muted: p.secondary,
    mutedForeground: p.muted, accent: p.accent, accentForeground: p.primary,
    destructive: dark ? '#ffb6a6' : '#a13d30',
    destructiveForeground: dark ? '#071016' : '#ffffff',
    destructiveSoft: dark ? '#371d25' : '#fff0eb',
    destructiveBorder: dark ? '#91574d' : '#d69b8e',
    border: p.border, input: p.border, accentBorder: p.border,
    ink: p.ink, inkForeground: '#f8fbff', inkSoft: '#c6d6db',
    inkSecondary: dark ? p.secondary : '#2a3b45',
    mint: '#9ce5ce', coral: '#ffbca4',
    chartMeasurement: dark ? '#ffbca4' : '#b24c2d',
  };
}

function light(id: string, name: string, background: string, primary: string, accent: string, ink: string): AppTheme {
  return { id, name, mode: 'light', palette: palette('light', {
    background, primary, accent, ink, card: '#fffdf9',
    foreground: '#202d35', secondary: background, muted: '#54616a', border: '#a3a9ae',
  }) };
}
function dark(id: string, name: string, background: string, card: string, primary: string, secondary: string, ink: string): AppTheme {
  return { id, name, mode: 'dark', palette: palette('dark', {
    background, card, primary, secondary, ink, accent: secondary,
    foreground: '#f5f7fa', muted: '#c0cbd4', border: '#677987',
  }) };
}

export const themes: readonly AppTheme[] = [
  { id: 'classic', name: 'Clear Access Classic', mode: 'light', palette: classic },
  light('forest', 'Forest', '#f2f5ef', '#245b36', '#e6f0e3', '#142d22'),
  light('mint', 'Mint', '#edf7f2', '#14614d', '#dceee5', '#12322a'),
  light('ocean', 'Ocean', '#f0f5f8', '#165d85', '#e0edf5', '#112c3e'),
  light('sky', 'Sky', '#edf4ff', '#2356a8', '#dfeaff', '#122947'),
  light('lavender', 'Lavender', '#f3effa', '#6941a5', '#e9e0f5', '#281d3e'),
  light('rose', 'Rose', '#fcf0f3', '#963757', '#f4e1e8', '#3b1d2b'),
  light('peach', 'Peach', '#fff3e9', '#9a4921', '#fae5d4', '#38271c'),
  light('sunflower', 'Sunflower', '#fff9e6', '#865409', '#f7edc9', '#332b16'),
  light('terracotta', 'Terracotta', '#faf0e9', '#9d4835', '#f2e0d5', '#37221c'),
  dark('midnight', 'Midnight', '#091522', '#122336', '#73d9f2', '#20354b', '#152b43'),
  dark('charcoal', 'Charcoal', '#15191d', '#20272d', '#92e0c3', '#303940', '#17252b'),
  dark('deep-forest', 'Deep Forest', '#0d1c16', '#172c22', '#a7ddb5', '#294438', '#143126'),
  dark('deep-ocean', 'Deep Ocean', '#081b2a', '#112d43', '#8ed0ff', '#203e53', '#12314a'),
  dark('amethyst', 'Amethyst', '#1b1329', '#2b203e', '#d8b6ff', '#403052', '#2c2145'),
  dark('burgundy', 'Burgundy', '#25131c', '#38202d', '#ffb6d1', '#4d2e3e', '#38202c'),
  dark('espresso', 'Espresso', '#201915', '#32271f', '#f1cfac', '#46372b', '#35271f'),
  dark('graphite', 'Graphite', '#141b24', '#222d3a', '#9bcaff', '#354251', '#1c3044'),
  { id: 'high-contrast-light', name: 'High Contrast Light', mode: 'light', palette: {
    ...palette('light', { background: '#ffffff', card: '#ffffff', foreground: '#000000',
      primary: '#0047a8', secondary: '#eeeeee', accent: '#e1edff', muted: '#333333', border: '#000000', ink: '#000000' }),
    input: '#000000', accentBorder: '#000000',
  } },
  { id: 'high-contrast-dark', name: 'High Contrast Dark', mode: 'dark', palette: {
    ...palette('dark', { background: '#000000', card: '#090909', foreground: '#ffffff',
      primary: '#ffe76a', secondary: '#1b1b1b', accent: '#202000', muted: '#e0e0e0', border: '#ffffff', ink: '#101010' }),
    input: '#ffffff', accentBorder: '#ffffff',
  } },
  ...extraLightThemes.map(spec => light(...spec)),
  ...extraDarkThemes.map(spec => dark(...spec)),
];

export const DEFAULT_THEME_ID = 'classic';
export function findTheme(id: string): AppTheme | undefined {
  return themes.find(theme => theme.id === id);
}
const colors = { light: classic, radius: 14 };
export default colors;
