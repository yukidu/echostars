import { ThemePalette } from '../types';

export const LIGHT_PALETTES: ThemePalette[] = [
  {
    id: 'dusty-rose',
    name: '藕粉玫瑰 (經典)',
    primary: '#c06c84',
    primaryHover: '#b15b73',
    lightPill: '#fae8ed',
    accentScrubber: '#c06c84',
    gradientBg: 'linear-gradient(135deg, #fdf8f9 0%, #f9f1f3 50%, #fdf9fb 100%)',
    cardBg: '#ffffff',
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    borderSubtle: '#f1e7ea'
  },
  {
    id: 'sage-mint',
    name: '青嵐鼠尾草',
    primary: '#4c7c59',
    primaryHover: '#3d6748',
    lightPill: '#eaf4ee',
    accentScrubber: '#4c7c59',
    gradientBg: 'linear-gradient(135deg, #f7fbf8 0%, #edf5ef 50%, #f6faf7 100%)',
    cardBg: '#ffffff',
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    borderSubtle: '#e2ede5'
  },
  {
    id: 'lavender-mist',
    name: '鳶尾薰衣草',
    primary: '#7c5295',
    primaryHover: '#6a4382',
    lightPill: '#f3eef8',
    accentScrubber: '#7c5295',
    gradientBg: 'linear-gradient(135deg, #faf7fc 0%, #f2ebf7 50%, #f9f6fc 100%)',
    cardBg: '#ffffff',
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    borderSubtle: '#ede5f3'
  },
  {
    id: 'dawn-peach',
    name: '晨曦蜜桃',
    primary: '#cb6d51',
    primaryHover: '#b55a3f',
    lightPill: '#fdf0ea',
    accentScrubber: '#cb6d51',
    gradientBg: 'linear-gradient(135deg, #fef8f5 0%, #fbede5 50%, #fdf9f7 100%)',
    cardBg: '#ffffff',
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    borderSubtle: '#fae5db'
  },
  {
    id: 'serene-azure',
    name: '晴空冰藍',
    primary: '#3a7ca5',
    primaryHover: '#2e678b',
    lightPill: '#eaf3f8',
    accentScrubber: '#3a7ca5',
    gradientBg: 'linear-gradient(135deg, #f5f9fc 0%, #eaf1f7 50%, #f6fafd 100%)',
    cardBg: '#ffffff',
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    borderSubtle: '#dfeaf2'
  },
  {
    id: 'warm-sand',
    name: '暖陽燕麥',
    primary: '#b07d4b',
    primaryHover: '#986839',
    lightPill: '#faf2ea',
    accentScrubber: '#b07d4b',
    gradientBg: 'linear-gradient(135deg, #fdfaf6 0%, #f7f1e7 50%, #fdfbf8 100%)',
    cardBg: '#ffffff',
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    borderSubtle: '#efe5d8'
  },
  {
    id: 'matcha-tea',
    name: '靜謐抹茶',
    primary: '#557c55',
    primaryHover: '#446644',
    lightPill: '#edf4ed',
    accentScrubber: '#557c55',
    gradientBg: 'linear-gradient(135deg, #f8fbf8 0%, #edf5ed 50%, #f7fbf7 100%)',
    cardBg: '#ffffff',
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    borderSubtle: '#e2ede2'
  },
  {
    id: 'berry-plum',
    name: '桑葚野莓',
    primary: '#a24874',
    primaryHover: '#8b3b62',
    lightPill: '#fbebf2',
    accentScrubber: '#a24874',
    gradientBg: 'linear-gradient(135deg, #fdf7fa 0%, #f8edf3 50%, #fdf9fb 100%)',
    cardBg: '#ffffff',
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    borderSubtle: '#f5e2ed'
  },
  {
    id: 'glacier-cyan',
    name: '琉璃青瓷',
    primary: '#2e86ab',
    primaryHover: '#236e8e',
    lightPill: '#e9f5f9',
    accentScrubber: '#2e86ab',
    gradientBg: 'linear-gradient(135deg, #f4fafb 0%, #e9f3f6 50%, #f5fbfc 100%)',
    cardBg: '#ffffff',
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    borderSubtle: '#dbeaf0'
  },
  {
    id: 'sunset-coral',
    name: '霞光暖杏',
    primary: '#c4685d',
    primaryHover: '#ae554a',
    lightPill: '#fdf0ee',
    accentScrubber: '#c4685d',
    gradientBg: 'linear-gradient(135deg, #fdf8f7 0%, #fbeeed 50%, #fdf9f8 100%)',
    cardBg: '#ffffff',
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    borderSubtle: '#f7e2df'
  }
];

export const DARK_THEME: ThemePalette = {
  id: 'fixed-dark',
  name: '深邃夜幕 (固定)',
  primary: '#c06c84',
  primaryHover: '#b15b73',
  lightPill: '#1a1e2b',
  accentScrubber: '#c06c84',
  gradientBg: 'linear-gradient(135deg, #0d0f17 0%, #131722 50%, #0c0e15 100%)',
  cardBg: '#181c28',
  textPrimary: '#f8fafc',
  textSecondary: '#94a3b8',
  borderSubtle: '#23293b'
};

export function getRandomLightPalette(excludeId?: string): ThemePalette {
  const filtered = excludeId ? LIGHT_PALETTES.filter(p => p.id !== excludeId) : LIGHT_PALETTES;
  const index = Math.floor(Math.random() * filtered.length);
  return filtered[index];
}

/**
 * Requirement 20: 淺色系切換、深色系切換，主視覺色會維持同一個顏色。
 */
export function applyThemeToDom(palette: ThemePalette, isDark: boolean) {
  const root = document.documentElement;

  // Primary color and accents ALWAYS stay identical across dark and light modes!
  // 置頂麥克風 logo 填色即為 var(--color-primary)
  root.style.setProperty('--color-primary', palette.primary);
  root.style.setProperty('--color-primary-hover', palette.primaryHover);
  root.style.setProperty('--color-accent-scrubber', palette.primary);

  if (isDark) {
    root.classList.add('dark');
    root.style.setProperty('--color-light-pill', '#1a1e2b');
    root.style.setProperty('--theme-box-bg', '#181c28');
    root.style.setProperty('--theme-gradient-bg', 'linear-gradient(135deg, #0d0f17 0%, #131722 50%, #0c0e15 100%)');
    root.style.setProperty('--theme-card-bg', '#181c28');
    root.style.setProperty('--theme-text-primary', '#f8fafc');
    root.style.setProperty('--theme-text-secondary', '#94a3b8');
    root.style.setProperty('--theme-border-subtle', '#23293b');
  } else {
    root.classList.remove('dark');
    root.style.setProperty('--color-light-pill', palette.lightPill);
    // Requirement 7: 恢復漂亮淺色系框框底色
    root.style.setProperty('--theme-box-bg', '#ffffff');
    root.style.setProperty('--color-primary-50', `${palette.primary}15`);
    root.style.setProperty('--theme-gradient-bg', palette.gradientBg);
    root.style.setProperty('--theme-card-bg', palette.cardBg);
    root.style.setProperty('--theme-text-primary', palette.textPrimary);
    root.style.setProperty('--theme-text-secondary', palette.textSecondary);
    root.style.setProperty('--theme-border-subtle', palette.borderSubtle);
  }
}
