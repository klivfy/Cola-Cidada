/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1B211D',
    background: '#F7F8F5',
    backgroundElement: '#ECEFEB',
    backgroundSelected: '#DCEFE2',
    textSecondary: '#465149',
    primary: '#176B3A',
    onPrimary: '#FFFFFF',
    primaryContainer: '#DCEFE2',
    secondary: '#28527A',
    accent: '#805F00',
    danger: '#BA1A1A',
    border: '#C5CEC6',
  },
  dark: {
    text: '#E2E8E2',
    background: '#121713',
    backgroundElement: '#1E251F',
    backgroundSelected: '#234B31',
    textSecondary: '#C2CBC3',
    primary: '#91D5A5',
    onPrimary: '#123A23',
    primaryContainer: '#234B31',
    secondary: '#A9C7E3',
    accent: '#E8C567',
    danger: '#FFB4AB',
    border: '#414B43',
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
