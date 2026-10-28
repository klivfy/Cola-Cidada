/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1A1C1E',
    background: '#F9F9FC',
    backgroundElement: '#F3F3F6',
    backgroundSelected: '#DFF2E1',
    textSecondary: '#3E4A3D',
    primary: '#006B26',
    onPrimary: '#FFFFFF',
    primaryContainer: '#DFF2E1',
    secondary: '#3854C6',
    accent: '#6D5E00',
    danger: '#BA1A1A',
    border: '#BECAB9',
  },
  dark: {
    text: '#E1E3DF',
    background: '#111412',
    backgroundElement: '#1D211E',
    backgroundSelected: '#00531E',
    textSecondary: '#C2C9BD',
    primary: '#8BD89A',
    onPrimary: '#003911',
    primaryContainer: '#00531E',
    secondary: '#B6C4FF',
    accent: '#FFE085',
    danger: '#FFB4AB',
    border: '#424940',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
