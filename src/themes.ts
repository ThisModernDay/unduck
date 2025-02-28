export interface Theme {
  id: string;
  name: string;
  colors: {
    background: string;
    backgroundGradient: string;
    cardBackground: string;
    cardBackgroundHover: string;
    primary: string;
    secondary: string;
    text: string;
    textSecondary: string;
    border: string;
    buttonHover: string;
  };
}

// Single Catppuccino Mocha theme following official style guide
export const theme: Theme = {
  id: 'catppuccin-mocha',
  name: 'Catppuccin Mocha',
  colors: {
    // Base background color (#1E1E2E)
    background: 'bg-[#1E1E2E]',
    // Gradient from base to surface0 and mantle
    backgroundGradient: 'from-[#1E1E2E] via-[#313244] to-[#181825]',
    // Surface0 with some transparency for card backgrounds
    cardBackground: 'bg-[#313244]/80',
    // Surface1 for hover states
    cardBackgroundHover: 'bg-[#45475A]/50',
    // Surface0 with transparency for primary elements
    primary: 'bg-[#313244]/30',
    // Surface1 with transparency for secondary elements
    secondary: 'bg-[#45475A]/40',
    // Text color (#CDD6F4)
    text: 'text-[#CDD6F4]',
    // Subtext0 for secondary text (#A6ADC8)
    textSecondary: 'text-[#A6ADC8]',
    // Lavender with low opacity for borders
    border: 'border-[#B4BEFE]/20',
    // Overlay2 with low opacity for button hover states
    buttonHover: 'hover:bg-[#9399B2]/30',
  }
};

// For backward compatibility, keep the themes array with just the one theme
export const themes: Theme[] = [theme];

// Simplified getTheme function that always returns the Catppuccin theme
export const getTheme = (): Theme => {
  return theme;
};

// These functions are kept for backward compatibility but simplified
export const THEME_STORAGE_KEY = 'unduck-theme';

export const getStoredTheme = (): string => {
  return 'catppuccin-mocha';
};

export const setStoredTheme = (): void => {
  // No-op since we only have one theme
};