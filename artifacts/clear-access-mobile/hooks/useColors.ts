import colors from '@/constants/colors';
import { useTheme } from '@/contexts/ThemeProvider';

/**
 * Explicit device-local choice takes precedence over the system color scheme.
 */
export function useColors() {
  const { theme } = useTheme();
  return { ...theme.palette, radius: colors.radius, isDark: theme.mode === 'dark' };
}
