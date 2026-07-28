import { STORAGE_KEYS } from './storage.js';

export const THEME_STORAGE_KEY = STORAGE_KEYS.theme;
export const DEFAULT_THEME_ID = 'washi';

const sharedGradientTokens = {
  '--surface-gradient': 'linear-gradient(180deg, var(--panel-raised), var(--panel-soft))',
  '--surface-soft-gradient': 'linear-gradient(180deg, var(--panel), var(--panel-soft))',
  '--surface-accent-gradient': 'linear-gradient(135deg, var(--accent-soft), var(--warning-soft))',
  '--action-gradient': 'linear-gradient(180deg, var(--action), var(--action-strong))',
  '--progress-gradient': 'linear-gradient(90deg, var(--muted), var(--accent))',
  '--success-gradient': 'linear-gradient(90deg, var(--success-soft), transparent)',
  '--warning-gradient': 'linear-gradient(90deg, var(--warning-soft), transparent)',
  '--accent-row-gradient': 'linear-gradient(90deg, var(--accent-soft), transparent)',
};

const theme = ({ id, label, japanese, themeColor, colorScheme, tokens }) => Object.freeze({
  id,
  label,
  japanese,
  themeColor,
  colorScheme,
  tokens: Object.freeze({ ...tokens, ...sharedGradientTokens }),
});

export const THEMES = Object.freeze([
  theme({
    id: 'washi',
    label: 'Washi',
    japanese: '和紙',
    themeColor: '#F5F0E7',
    colorScheme: 'light',
    tokens: {
      '--bg': '#F5F0E7',
      '--bg-end': '#EDE2D4',
      '--panel': '#FBF8F2',
      '--panel-raised': '#FFFFFF',
      '--panel-soft': '#EFE7DC',
      '--ink': '#1E1A17',
      '--muted': '#63584F',
      '--line': '#D9CCBE',
      '--control-line': '#88766A',
      '--accent': '#9F3025',
      '--accent-strong': '#7D251B',
      '--accent-soft': '#EAD3CC',
      '--on-accent': '#FFFFFF',
      '--focus': '#00667A',
      '--action': '#241F1B',
      '--action-strong': '#181411',
      '--on-action': '#FFFFFF',
      '--success': '#24633E',
      '--success-soft': '#DCEBDD',
      '--warning': '#7A4B00',
      '--warning-soft': '#F3E3BF',
      '--header-bg': 'rgba(251,248,242,.96)',
      '--header-border': 'rgba(99,88,79,.18)',
      '--hero-start': 'rgba(255,249,246,.96)',
      '--hero-end': 'rgba(248,236,235,.98)',
      '--hero-border': '#E7C9C5',
      '--hero-glow': 'rgba(159,48,37,.10)',
      '--shadow': '0 18px 42px rgba(30,26,23,.10)',
      '--shadow-soft': '0 10px 24px rgba(30,26,23,.08)',
      '--mark-bg': '#FFFFFF',
      '--stone-start': '#85776A',
      '--stone-end': '#5D534A',
      '--lantern-start': '#F1DFB1',
      '--lantern-end': '#B88948',
      '--blossom-center': '#F8D7DC',
      '--blossom-edge': '#D48C97',
      '--bead': '#DCC8A1',
      '--bead-border': '#B99A62',
      '--bead-active': '#B14532',
      '--bead-active-border': '#8D2E22',
      '--decorative-filter': 'none',
      '--decorative-opacity': '1',
      '--hero-overlay': 'linear-gradient(135deg, var(--hero-start), var(--hero-end))',
    },
  }),
  theme({
    id: 'sakura',
    label: 'Sakura',
    japanese: '桜',
    themeColor: '#FFF4F2',
    colorScheme: 'light',
    tokens: {
      '--bg': '#FFF4F2',
      '--bg-end': '#F1DEDF',
      '--panel': '#FFF9F8',
      '--panel-raised': '#FFFFFF',
      '--panel-soft': '#F5E3E5',
      '--ink': '#2A1B1E',
      '--muted': '#6C4C52',
      '--line': '#E4C8CC',
      '--control-line': '#947079',
      '--accent': '#982745',
      '--accent-strong': '#74182F',
      '--accent-soft': '#F2D3DC',
      '--on-accent': '#FFFFFF',
      '--focus': '#00677D',
      '--action': '#3A2027',
      '--action-strong': '#28151A',
      '--on-action': '#FFFFFF',
      '--success': '#28623F',
      '--success-soft': '#DDEBDF',
      '--warning': '#785000',
      '--warning-soft': '#F6E6BC',
      '--header-bg': 'rgba(255,249,248,.96)',
      '--header-border': 'rgba(108,76,82,.20)',
      '--hero-start': 'rgba(255,247,248,.96)',
      '--hero-end': 'rgba(251,229,235,.98)',
      '--hero-border': '#E9C4CC',
      '--hero-glow': 'rgba(152,39,69,.12)',
      '--shadow': '0 18px 42px rgba(72,31,42,.11)',
      '--shadow-soft': '0 10px 24px rgba(72,31,42,.09)',
      '--mark-bg': '#FFFFFF',
      '--stone-start': '#947A7F',
      '--stone-end': '#675358',
      '--lantern-start': '#F5DFB4',
      '--lantern-end': '#B98258',
      '--blossom-center': '#FFE4EA',
      '--blossom-edge': '#C96F84',
      '--bead': '#E5C5B0',
      '--bead-border': '#B98670',
      '--bead-active': '#B83F63',
      '--bead-active-border': '#84233F',
      '--decorative-filter': 'none',
      '--decorative-opacity': '1',
      '--hero-overlay': 'linear-gradient(135deg, var(--hero-start), var(--hero-end))',
    },
  }),
  theme({
    id: 'sumi',
    label: 'Sumi',
    japanese: '墨',
    themeColor: '#171716',
    colorScheme: 'dark',
    tokens: {
      '--bg': '#171716',
      '--bg-end': '#101010',
      '--panel': '#242321',
      '--panel-raised': '#2D2B28',
      '--panel-soft': '#302E2A',
      '--ink': '#F7F1E7',
      '--muted': '#C8BEB1',
      '--line': '#4D4943',
      '--control-line': '#8E857A',
      '--accent': '#FF9B87',
      '--accent-strong': '#FFC0B2',
      '--accent-soft': '#4A2D2A',
      '--on-accent': '#241511',
      '--focus': '#6DD6FF',
      '--action': '#F0E4D4',
      '--action-strong': '#D8C9B7',
      '--on-action': '#1A1816',
      '--success': '#81D6A3',
      '--success-soft': '#183B2A',
      '--warning': '#F1C96A',
      '--warning-soft': '#453A20',
      '--header-bg': 'rgba(36,35,33,.97)',
      '--header-border': 'rgba(200,190,177,.24)',
      '--hero-start': 'rgba(43,36,36,.97)',
      '--hero-end': 'rgba(51,36,42,.99)',
      '--hero-border': '#644B4A',
      '--hero-glow': 'rgba(255,155,135,.15)',
      '--shadow': '0 18px 42px rgba(0,0,0,.42)',
      '--shadow-soft': '0 10px 24px rgba(0,0,0,.34)',
      '--mark-bg': '#35322F',
      '--stone-start': '#A59A8E',
      '--stone-end': '#6F665E',
      '--lantern-start': '#E8C981',
      '--lantern-end': '#9C703D',
      '--blossom-center': '#FFD5DE',
      '--blossom-edge': '#B95F75',
      '--bead': '#9D825B',
      '--bead-border': '#D0B27E',
      '--bead-active': '#FF9B87',
      '--bead-active-border': '#FFC0B2',
      '--decorative-filter': 'saturate(.55) brightness(.78)',
      '--decorative-opacity': '.72',
      '--hero-overlay': 'linear-gradient(135deg, var(--hero-start), var(--hero-end))',
    },
  }),
]);

export const THEME_IDS = Object.freeze(THEMES.map(({ id }) => id));
export const THEME_BY_ID = Object.freeze(Object.fromEntries(THEMES.map((entry) => [entry.id, entry])));

export const normalizeThemeId = (value) => (
  typeof value === 'string' && THEME_IDS.includes(value) ? value : DEFAULT_THEME_ID
);

export const readStoredTheme = (storage) => {
  try {
    return normalizeThemeId(storage?.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME_ID;
  }
};

export const applyTheme = (documentRef, value) => {
  const themeId = normalizeThemeId(value);
  const selected = THEME_BY_ID[themeId];
  const root = documentRef?.documentElement;
  if (root) {
    root.dataset.theme = themeId;
    root.style.colorScheme = selected.colorScheme;
  }
  const meta = documentRef?.querySelector?.('meta[name="theme-color"]');
  meta?.setAttribute('content', selected.themeColor);
  return selected;
};

export const buildThemeCss = () => THEMES.map((entry, index) => {
  const selector = index === 0
    ? `:root, :root[data-theme="${entry.id}"]`
    : `:root[data-theme="${entry.id}"]`;
  const declarations = Object.entries(entry.tokens)
    .map(([name, value]) => `${name}:${value};`)
    .join('');
  return `${selector}{${declarations}color-scheme:${entry.colorScheme};}`;
}).join('');

export const themeBootstrapConfig = Object.freeze({
  storageKey: THEME_STORAGE_KEY,
  defaultId: DEFAULT_THEME_ID,
  ids: THEME_IDS,
  metadata: Object.freeze(Object.fromEntries(THEMES.map(({ id, themeColor, colorScheme }) => [id, { themeColor, colorScheme }]))),
});
