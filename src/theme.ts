import { Platform } from 'react-native';

/** Travel-atlas palette: cream paper, navy ink, ocean-blue maps. */
export const colors = {
  paper: '#FBF6EC',
  paperDeep: '#F3EADA',
  card: '#FFFDF8',
  ink: '#14213D',
  inkSoft: '#4A5672',
  inkFaint: '#8A93A6',
  line: '#E4D9C4',
  ocean: '#2A7DA8',
  oceanDeep: '#1D5F82',
  oceanWash: '#BFE0EE',
  land: '#F6EFDC',
  landLine: '#C9BFA6',
  accent: '#E76F51',
  discovered: '#2A9D8F',
  success: '#1F7A4D',
  successWash: '#DDF1E4',
  danger: '#B3261E',
  dangerWash: '#FBE3E0',
  white: '#FFFFFF',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 14, lg: 20, pill: 999 };

export const fonts = {
  display: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, "Times New Roman", serif' }) as string,
  body: Platform.select({ web: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', default: undefined }) as string | undefined,
};

export const WIDE_BREAKPOINT = 900;
export const MAX_CONTENT_WIDTH = 1120;
